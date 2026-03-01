import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { getCollections } from "../db";
import { dayKey } from "../utils";
import { ObjectId } from "mongodb";
import { isFirebaseConfigured, verifyFirebaseIdToken } from "../services/firebase";

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const firebaseSchema = z.object({
  idToken: z.string().min(20).max(5000)
});

function setAuthCookie(res: any, token: string) {
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/"
  });
}

function signSession(userId: string) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user: { _id?: ObjectId; email: string; plan: string; firebaseUid?: string }) {
  return { id: user._id?.toString(), email: user.email, plan: user.plan, firebaseUid: user.firebaseUid || null };
}

router.post("/register", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const { users } = await getCollections();
  const existing = await users.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const result = await users.insertOne({
    email,
    passwordHash,
    plan: "free",
    dailyScanCount: 0,
    dailyScanDate: dayKey(),
    createdAt: now
  });

  const userId = result.insertedId.toString();
  const token = signSession(userId);
  setAuthCookie(res, token);

  const user = await users.findOne({ _id: new ObjectId(userId) });
  return res.json({ token, user: user ? publicUser(user) : null });
});

router.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const { users } = await getCollections();
  const user = await users.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.passwordHash) {
    return res.status(401).json({ error: "This account uses Firebase login. Sign in with Firebase or Google." });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signSession(user._id!.toString());
  setAuthCookie(res, token);

  return res.json({ token, user: publicUser(user) });
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    const { users } = await getCollections();
    const user = await users.findOne({ _id: new ObjectId(payload.userId) });
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/firebase", async (req, res) => {
  const parsed = firebaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid Firebase token payload" });

  if (!isFirebaseConfigured()) {
    return res.status(503).json({ error: "Firebase Authentication is not configured on API service" });
  }

  try {
    const decoded = await verifyFirebaseIdToken(parsed.data.idToken);
    if (!decoded.uid) return res.status(401).json({ error: "Invalid Firebase token" });

    const normalizedEmail =
      (decoded.email || "").trim().toLowerCase() || `${decoded.uid}@firebase.local`;

    const { users } = await getCollections();
    let user = await users.findOne({ firebaseUid: decoded.uid });

    if (!user && normalizedEmail) {
      const byEmail = await users.findOne({ email: normalizedEmail });
      if (byEmail) {
        await users.updateOne(
          { _id: byEmail._id },
          { $set: { firebaseUid: decoded.uid, email: normalizedEmail } }
        );
        user = { ...byEmail, firebaseUid: decoded.uid, email: normalizedEmail };
      }
    }

    if (!user) {
      const insert = await users.insertOne({
        email: normalizedEmail,
        passwordHash: "",
        firebaseUid: decoded.uid,
        plan: "free",
        dailyScanCount: 0,
        dailyScanDate: dayKey(),
        createdAt: new Date()
      });

      user = await users.findOne({ _id: insert.insertedId });
    }

    if (!user || !user._id) {
      return res.status(500).json({ error: "Failed to create user session" });
    }

    const token = signSession(user._id.toString());
    setAuthCookie(res, token);
    return res.json({ token, user: publicUser(user) });
  } catch {
    return res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
});

router.post("/logout", async (_req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  return res.json({ ok: true });
});

export default router;
