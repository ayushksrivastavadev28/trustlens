import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../middleware/auth";
import { config } from "../config";
import { getCollections } from "../db";

const router = Router();

router.get("/billing/status", requireAuth, async (req, res) => {
  const user = req.user!;
  const userId = user._id!;
  const url = `https://api.revenuecat.com/v1/subscribers/${userId.toString()}`;
  const rc = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.REVENUECAT_SECRET_API_KEY}`
    }
  });

  if (!rc.ok) {
    const text = await rc.text();
    return res.status(502).json({ error: "RevenueCat error", detail: text });
  }

  const data = await rc.json();
  const active = data?.subscriber?.entitlements?.active || {};
  const isPro = Boolean(active[config.REVENUECAT_ENTITLEMENT_ID]);

  const { users } = await getCollections();
  await users.updateOne({ _id: userId }, { $set: { plan: isPro ? "pro" : "free" } });

  return res.json({ isPro, entitlementId: config.REVENUECAT_ENTITLEMENT_ID });
});

router.post("/webhooks/revenuecat", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth !== `Bearer ${config.REVENUECAT_SECRET_API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body?.event;
  const appUserId = event?.app_user_id || event?.subscriber?.app_user_id;
  const entitlementId = event?.entitlement_id;
  const type = event?.type || "";

  if (!appUserId) return res.status(400).json({ error: "Missing app_user_id" });
  const isActive = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"].includes(type.toUpperCase());

  if (entitlementId && entitlementId === config.REVENUECAT_ENTITLEMENT_ID) {
    const { users } = await getCollections();
    await users.updateOne({ _id: new ObjectId(appUserId) }, { $set: { plan: isActive ? "pro" : "free" } });
  }

  return res.json({ ok: true });
});

export default router;
