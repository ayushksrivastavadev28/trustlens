import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { getCollections } from "../db";
import { User } from "../types";
import { ObjectId } from "mongodb";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.auth_token;
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    const { users } = await getCollections();
    const user = await users.findOne({ _id: new ObjectId(payload.userId) });
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.plan !== "pro") return res.status(402).json({ error: "Pro required" });
  return next();
}
