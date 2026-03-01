import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { analyzeLimiter } from "../middleware/rateLimit";
import { sanitizeUrls, dayKey, labelToRisk, computeTrustScore, riskLevelFromScore } from "../utils";
import { callAI } from "../services/ai";
import { getCollections } from "../db";
import { computeCommunitySignals } from "../services/community";
import { asyncHandler } from "../asyncHandler";

const router = Router();

const schema = z.object({
  text: z.string().min(1).max(5000),
  inputType: z.enum(["sms", "email", "message"]),
  urls: z.array(z.string()).optional().default([])
});

router.post("/analyze", requireAuth, analyzeLimiter, asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { users, scans } = await getCollections();
  const user = req.user!;

  const today = dayKey();
  let dailyScanCount = user.dailyScanCount || 0;
  if (user.dailyScanDate !== today) {
    dailyScanCount = 0;
  }

  const isPro = user.plan === "pro";
  const dailyLimit = 10;
  if (!isPro && dailyScanCount >= dailyLimit) {
    return res.status(402).json({ error: "Daily scan limit reached" });
  }

  const urls = sanitizeUrls(parsed.data.urls || []);
  const requestId = randomUUID();

  let aiResponse: any;
  try {
    aiResponse = await callAI({
      text: parsed.data.text,
      inputType: parsed.data.inputType,
      urls,
      locale: "auto",
      requestId
    });
  } catch (err: any) {
    return res.status(502).json({ error: "AI service unavailable", detail: err?.message || "Unknown AI error" });
  }

  const community = await computeCommunitySignals(aiResponse.embedding || []);

  const smsRisk = labelToRisk(aiResponse.classifiers.smsSpam.label, aiResponse.classifiers.smsSpam.score);
  const phishingRisk = labelToRisk(aiResponse.classifiers.phishingEmail.label, aiResponse.classifiers.phishingEmail.score);
  const textRisk = (smsRisk + phishingRisk) / 2;
  const behaviorRisk = aiResponse.behavior?.confidence || 0;
  const urlRisk = (aiResponse.urlIntel?.overallRisk || 0) / 100;
  const trustScore = computeTrustScore({
    textRisk,
    behaviorRisk,
    urlRisk,
    communityRisk: community.risk
  });
  const riskLevel = riskLevelFromScore(trustScore);

  const scanDoc = {
    userId: user._id,
    requestId,
    input: { text: parsed.data.text, inputType: parsed.data.inputType, urls },
    ai: aiResponse,
    community,
    trustScore,
    riskLevel,
    embedding: aiResponse.embedding || [],
    createdAt: new Date()
  };

  const result = await scans.insertOne(scanDoc as any);

  await users.updateOne(
    { _id: user._id },
    {
      $set: { dailyScanDate: today },
      $inc: { dailyScanCount: 1 }
    }
  );

  return res.json({
    scanId: result.insertedId.toString(),
    trustScore,
    riskLevel,
    community,
    subscription: {
      isPro,
      dailyLimit,
      scansRemaining: isPro ? null : Math.max(0, dailyLimit - (dailyScanCount + 1))
    },
    ...aiResponse
  });
}));

export default router;
