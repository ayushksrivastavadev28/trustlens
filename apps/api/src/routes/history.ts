import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth, requirePro } from "../middleware/auth";
import { getCollections } from "../db";

const router = Router();

router.get("/history", requireAuth, requirePro, async (req, res) => {
  const { scans } = await getCollections();
  const items = await scans
    .find({ userId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return res.json({ items });
});

router.get("/scans/:scanId", requireAuth, async (req, res) => {
  const { scans } = await getCollections();
  const scan = await scans.findOne({ _id: new ObjectId(req.params.scanId), userId: req.user!._id });
  if (!scan) return res.status(404).json({ error: "Not found" });
  return res.json({ scan });
});

export default router;
