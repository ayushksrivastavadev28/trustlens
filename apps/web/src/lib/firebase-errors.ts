"use client";

import { AuthError } from "firebase/auth";

function authCode(err: unknown) {
  return ((err as AuthError)?.code || "").toLowerCase();
}

export function isUnauthorizedDomainError(err: unknown) {
  return authCode(err).includes("auth/unauthorized-domain");
}

export function isPopupClosedError(err: unknown) {
  return authCode(err).includes("auth/popup-closed-by-user");
}

export function unauthorizedDomainMessage() {
  const host =
    typeof window !== "undefined" && window.location?.host ? window.location.host : "this domain";
  return `Firebase is blocking sign-in on ${host}. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
}

