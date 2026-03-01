import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string {
  return process.env[name] || "";
}

export const config = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  MONGODB_URI: required("MONGODB_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  AI_SERVICE_URL: required("AI_SERVICE_URL"),
  AI_SERVICE_TOKEN: required("AI_SERVICE_TOKEN"),
  REVENUECAT_SECRET_API_KEY: optional("REVENUECAT_SECRET_API_KEY"),
  REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID || "pro",
  FIREBASE_PROJECT_ID: optional("FIREBASE_PROJECT_ID"),
  FIREBASE_CLIENT_EMAIL: optional("FIREBASE_CLIENT_EMAIL"),
  FIREBASE_PRIVATE_KEY: optional("FIREBASE_PRIVATE_KEY")
};
