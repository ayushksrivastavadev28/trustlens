import { ObjectId } from "mongodb";

export type PlanTier = "free" | "pro";

export interface User {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  firebaseUid?: string;
  plan: PlanTier;
  dailyScanCount: number;
  dailyScanDate: string;
  createdAt: Date;
}

export interface Scan {
  _id?: ObjectId;
  userId: ObjectId;
  requestId: string;
  input: {
    text: string;
    inputType: "sms" | "email" | "message";
    urls: string[];
  };
  ai: any;
  community: any;
  trustScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  embedding: number[];
  createdAt: Date;
}

export interface Report {
  _id?: ObjectId;
  label: string;
  text: string;
  embedding: number[];
  createdAt: Date;
}
