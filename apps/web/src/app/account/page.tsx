"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AuthError,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { billingStatus, firebaseLogin, logout } from "@/lib/api";
import { configurePurchases, getClientProStatus } from "@/lib/revenuecat";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";

type SessionUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  firebaseUid?: string | null;
};

function toFriendlyError(err: unknown) {
  const code = (err as AuthError)?.code || "";
  if (code.includes("auth/invalid-credential")) return "Invalid email or password.";
  if (code.includes("auth/email-already-in-use")) return "Email is already registered.";
  if (code.includes("auth/weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("auth/popup-closed-by-user")) return "Google sign-in popup was closed.";
  return (err as Error)?.message || "Authentication failed.";
}

export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const firebaseReady = useMemo(() => firebaseEnabled && !!auth, []);

  const refreshBilling = async () => {
    try {
      const serverPro = await billingStatus();
      const clientPro = await getClientProStatus();
      setIsPro(Boolean(clientPro || serverPro?.isPro));
    } catch {
      setIsPro(false);
    }
  };

  const syncSession = async (firebaseUser: User) => {
    const idToken = await firebaseUser.getIdToken();
    const session = await firebaseLogin(idToken);
    setUser(session.user);
    configurePurchases(session.user.id);
    await refreshBilling();
  };

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setIsPro(false);
          return;
        }

        await syncSession(firebaseUser);
      } catch (err: any) {
        const apiMessage =
          err?.message?.includes("Firebase Authentication is not configured")
            ? "API Firebase is not configured. Add Firebase Admin env vars in apps/api."
            : err?.message || "Failed to establish session.";
        toast.error(apiMessage);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebaseReady]);

  const handleLogin = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success("Signed in");
    } catch (err) {
      toast.error(toFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      toast.success("Account created");
    } catch (err) {
      toast.error(toFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) return;
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in with Google");
    } catch (err) {
      toast.error(toFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      if (auth) await signOut(auth);
      await logout().catch(() => undefined);
      setUser(null);
      setIsPro(false);
      toast.success("Logged out");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Card className="glass p-6 shadow-soft">Loading account...</Card>
        </div>
      </main>
    );
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Card className="glass p-6 shadow-soft">
            <h1 className="text-2xl font-semibold">Firebase setup required</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Set Firebase web environment variables in <code>apps/web/.env.local</code> to enable sign-in.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Card className="glass p-6 shadow-soft">
            <h1 className="text-2xl font-semibold">Account</h1>
            <p className="mt-2 text-sm text-muted-foreground">Secure sign-in powered by Firebase Authentication.</p>
            <Tabs defaultValue="login" className="mt-6">
              <TabsList>
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4 space-y-3">
                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleLogin} disabled={busy}>{busy ? "Please wait..." : "Login"}</Button>
                  <Button variant="outline" onClick={handleGoogleLogin} disabled={busy}>Google</Button>
                </div>
              </TabsContent>
              <TabsContent value="register" className="mt-4 space-y-3">
                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="Password (min 6 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleRegister} disabled={busy}>{busy ? "Please wait..." : "Create Account"}</Button>
                  <Button variant="outline" onClick={handleGoogleLogin} disabled={busy}>Google</Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="glass p-6 shadow-soft">
          <h1 className="text-2xl font-semibold">Your Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm">Plan: {isPro ? "Pro" : "Free"}</span>
            <Button variant="outline" onClick={refreshBilling} disabled={busy}>Refresh Billing</Button>
            <Button variant="ghost" onClick={handleLogout} disabled={busy}>Logout</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
