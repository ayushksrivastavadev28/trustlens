import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";
import { config } from "../config";

let firebaseApp: App | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY);
}

function getFirebaseApp(): App {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase Admin is not configured");
  }

  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0]!;
    return firebaseApp;
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });

  return firebaseApp;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseApp();
  return getAuth(app).verifyIdToken(idToken, true);
}
