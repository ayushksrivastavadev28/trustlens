import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth, requirePro } from "../middleware/auth";
import { getCollections } from "../db";
import { asyncHandler } from "../asyncHandler";

const router = Router();

router.get("/history", requireAuth, requirePro, asyncHandler(async (req, res) => {
  const { scans } = await getCollections();
  const items = await scans
    .find({ userId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return res.json({
    items: items.map((scan) => ({
      _id: scan._id?.toString(),
      trustScore: scan.trustScore,
      riskLevel: scan.riskLevel,
      createdAt: scan.createdAt,
      requestId: scan.requestId,
      summary: scan.ai?.summary || ""
    }))
  });
}));

router.get("/scans/:scanId", requireAuth, asyncHandler(async (req, res) => {
  if (!ObjectId.isValid(req.params.scanId)) {
    return res.status(400).json({ error: "Invalid scan id" });
  }
  const { scans } = await getCollections();
  const scan = await scans.findOne({ _id: new ObjectId(req.params.scanId), userId: req.user!._id });
  if (!scan) return res.status(404).json({ error: "Not found" });
  return res.json({
    scan: {
      scanId: scan._id?.toString(),
      requestId: scan.requestId,
      trustScore: scan.trustScore,
      riskLevel: scan.riskLevel,
      input: scan.input,
      community: scan.community,
      createdAt: scan.createdAt,
      summary: scan.ai?.summary || "",
      proof: scan.ai?.proof || [],
      highlights: scan.ai?.highlights || [],
      behavior: scan.ai?.behavior || { tactics: [], confidence: 0 },
      urlIntel: scan.ai?.urlIntel || { overallRisk: 0, items: [] },
      classifiers: scan.ai?.classifiers || {
        smsSpam: { label: "unknown", score: 0 },
        phishingEmail: { label: "unknown", score: 0 }
      },
      suggestedActions: scan.ai?.suggestedActions || [],
      safeRewrite: scan.ai?.safeRewrite || null
    }
  });
}));

export default router;
