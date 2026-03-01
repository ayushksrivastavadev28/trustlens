"use client";

import { motion } from "framer-motion";
import { Chrome, LogIn, Shield, UserPlus } from "lucide-react";
import { useState } from "react";
import { AuthError, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";
import { firebaseLogin, login, register } from "@/lib/api";
import { isPopupClosedError, isUnauthorizedDomainError, unauthorizedDomainMessage } from "@/lib/firebase-errors";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type SessionUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  firebaseUid?: string | null;
};

type AuthWindowProps = {
  open: boolean;
  onComplete: (user: SessionUser) => void;
};

function toFriendlyError(err: unknown) {
  const code = (err as AuthError)?.code || "";
  if (code.includes("auth/invalid-credential")) return "Invalid email or password.";
  if (code.includes("auth/email-already-in-use")) return "Email is already registered.";
  if (code.includes("auth/weak-password")) return "Password must be at least 6 characters.";
  if (isPopupClosedError(err)) return "Google sign-in popup was closed.";
  if (isUnauthorizedDomainError(err)) return unauthorizedDomainMessage();
  return (err as Error)?.message || "Authentication failed.";
}

export function AuthWindow({ open, onComplete }: AuthWindowProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Enter email and password.");
      return;
    }

    setLoading(true);
    try {
      if (firebaseEnabled && auth) {
        try {
          if (mode === "login") {
            const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            const idToken = await cred.user.getIdToken();
            const session = await firebaseLogin(idToken);
            onComplete(session.user);
          } else {
            const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
            const idToken = await cred.user.getIdToken();
            const session = await firebaseLogin(idToken);
            onComplete(session.user);
          }
        } catch (firebaseErr) {
          if (isUnauthorizedDomainError(firebaseErr)) {
            const session = mode === "login"
              ? await login({ email: normalizedEmail, password })
              : await register({ email: normalizedEmail, password });
            toast.warning("Firebase domain is not authorized. Signed in using local TrustLens auth.");
            onComplete(session.user);
            return;
          }
          throw firebaseErr;
        }
      } else {
        const session = mode === "login"
          ? await login({ email: normalizedEmail, password })
          : await register({ email: normalizedEmail, password });
        onComplete(session.user);
      }
    } catch (err) {
      toast.error(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!firebaseEnabled || !auth || !googleProvider) {
      toast.error("Google sign-in requires Firebase web setup.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const session = await firebaseLogin(idToken);
      onComplete(session.user);
    } catch (err) {
      if (isUnauthorizedDomainError(err)) {
        toast.error(unauthorizedDomainMessage());
        return;
      }
      toast.error(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 px-6 dark:from-black dark:to-zinc-900">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 shadow-2xl shadow-blue-500/30">
            <Shield className="text-white" size={36} />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">TrustLens AI</h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
          />

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>

          <div className="relative my-2 text-center text-xs text-zinc-400">
            <span className="bg-white px-2 dark:bg-zinc-900">or</span>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white font-semibold text-zinc-700 transition hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <Chrome size={18} className="text-blue-600" />
            Continue with Google
          </button>

        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "login" ? "No account?" : "Already have an account?"}
          <button
            onClick={() => setMode((v) => (v === "login" ? "register" : "login"))}
            className="ml-2 font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
