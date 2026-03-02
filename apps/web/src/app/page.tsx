"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, HelpCircle, Info, Paperclip, Search, ShieldCheck, X } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { analyze, billingStatus, getMe, logout } from "@/lib/api";
import { AuthWindow } from "@/components/AuthWindow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { AnalysisResultPanel } from "@/components/AnalysisResultPanel";
import { PaywallModal } from "@/components/PaywallModal";
import { ProfilePanel } from "@/components/ProfilePanel";
import { TopNav } from "@/components/TopNav";
import { configurePurchases, getClientProStatus } from "@/lib/revenuecat";

type SessionUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  firebaseUid?: string | null;
};

type AppUser = SessionUser & {
  name: string;
  username: string;
  phoneNumber: string | null;
  profilePicture: string | null;
};

type UploadedAsset = {
  name: string;
  size: number;
  type: string;
};

const ONBOARDING_KEY = "trustlens_onboarding_done";
const THEME_KEY = "trustlens_theme";
const LANGUAGE_KEY = "trustlens_language";
const PROFILE_PREFIX = "trustlens_profile_";
const SCAN_COUNT_PREFIX = "trustlens_scan_count_";

function emailToName(email: string) {
  const raw = (email || "user").split("@")[0] || "user";
  const clean = raw.replace(/[._-]+/g, " ").trim();
  return clean
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildUser(sessionUser: SessionUser): AppUser {
  const base: AppUser = {
    ...sessionUser,
    name: emailToName(sessionUser.email),
    username: (sessionUser.email || "user").split("@")[0] || "user",
    phoneNumber: null,
    profilePicture: null
  };
  if (typeof window === "undefined") return base;

  try {
    const stored = localStorage.getItem(`${PROFILE_PREFIX}${sessionUser.id}`);
    if (!stored) return base;
    const parsed = JSON.parse(stored);
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

function extractUrls(text: string) {
  return Array.from(new Set((text.match(/https?:\/\/[^\s)]+/gi) || []).map((u) => u.trim())));
}

export default function HomePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [theme, setTheme] = useState<"default" | "light" | "dark">("default");
  const [language, setLanguage] = useState<"en" | "hi">("en");

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem(ONBOARDING_KEY) === "true";
    setShowOnboarding(!completed);

    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === "default" || storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }

    const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (storedLanguage === "en" || storedLanguage === "hi") {
      setLanguage(storedLanguage);
    }

    const loadSession = async () => {
      const me = await getMe().catch(() => null);
      if (me?.user) {
        const mergedUser = buildUser(me.user);
        setUser(mergedUser);
        configurePurchases(mergedUser.id);

        const storedCount = localStorage.getItem(`${SCAN_COUNT_PREFIX}${mergedUser.id}`);
        setScanCount(Number(storedCount || 0));

        const [serverBilling, clientPro] = await Promise.all([
          billingStatus().catch(() => null),
          getClientProStatus().catch(() => false)
        ]);
        setIsPro(Boolean(clientPro || serverBilling?.isPro || me.user.plan === "pro"));
      } else if (completed) {
        setShowAuth(true);
      }
    };
    void loadSession();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_KEY, theme);
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();
    if (theme === "default") {
      mediaQuery.addEventListener("change", applyTheme);
      return () => mediaQuery.removeEventListener("change", applyTheme);
    }
    return;
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const mapped = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream"
    }));
    setAttachments((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!input.trim() || isLoading) return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!isPro && scanCount >= 5) {
      setShowPaywall(true);
      return;
    }

    setIsLoading(true);
    try {
      const urls = extractUrls(input);
      const data = await analyze({
        text: input.trim(),
        inputType: "message",
        urls
      });
      setResult({
        ...data,
        input: { text: input.trim(), inputType: "message", urls },
        attachmentsCount: attachments.length
      });

      const nextCount = scanCount + 1;
      setScanCount(nextCount);
      localStorage.setItem(`${SCAN_COUNT_PREFIX}${user.id}`, String(nextCount));
    } catch (err: any) {
      if (err?.status === 401) {
        setUser(null);
        setShowAuth(true);
        toast.error("Session expired. Please sign in again.");
      } else if (err?.status === 402) {
        setShowPaywall(true);
        toast.error("Free scan limit reached. Upgrade to Pro.");
      } else {
        toast.error(err?.message || "Analysis failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setInput("");
    setAttachments([]);
    setResult(null);
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
    if (!user) setShowAuth(true);
  };

  const handleAuthComplete = async (sessionUser: SessionUser) => {
    const mergedUser = buildUser(sessionUser);
    setUser(mergedUser);
    setShowAuth(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
    configurePurchases(mergedUser.id);

    const [serverBilling, clientPro] = await Promise.all([
      billingStatus().catch(() => null),
      getClientProStatus().catch(() => false)
    ]);
    setIsPro(Boolean(clientPro || serverBilling?.isPro || sessionUser.plan === "pro"));

    const storedCount = localStorage.getItem(`${SCAN_COUNT_PREFIX}${mergedUser.id}`);
    setScanCount(Number(storedCount || 0));
  };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setUser(null);
    setIsPro(false);
    setShowProfile(false);
    setShowAuth(true);
    reset();
  };

  const handleUserUpdate = (updates: Partial<AppUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem(
        `${PROFILE_PREFIX}${prev.id}`,
        JSON.stringify({
          name: next.name,
          username: next.username,
          phoneNumber: next.phoneNumber || null,
          profilePicture: next.profilePicture || null
        })
      );
      return next;
    });
  };

  const freeRemaining = useMemo(() => Math.max(0, 5 - scanCount), [scanCount]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-zinc-900 selection:bg-blue-200 dark:bg-black dark:text-zinc-100 dark:selection:bg-blue-800">
      <TopNav
        isPro={isPro}
        email={user?.email}
        profilePicture={user?.profilePicture}
        onOpenPaywall={() => setShowPaywall(true)}
        onOpenProfile={() => setShowProfile(true)}
      />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="input-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-12 space-y-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 dark:bg-zinc-800"
                >
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Real-Time Security
                </motion.div>
                <h1 className="bg-gradient-to-b from-zinc-900 to-zinc-500 bg-clip-text pb-2 text-5xl font-bold tracking-tight text-transparent dark:from-white dark:to-zinc-500 sm:text-7xl">
                  Decide Before You Trust
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-zinc-500 dark:text-zinc-400 sm:text-xl">
                  Analyze messages, emails, and links with AI-powered trust scoring, proof mode, and community signals.
                </p>
              </div>

              <div className="relative w-full max-w-3xl">
                <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10 blur" />
                <div className="relative rounded-[2.5rem] border border-zinc-100 bg-white p-4 shadow-xl shadow-zinc-200/50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 4000))}
                    placeholder="Paste suspicious text/email/link message..."
                    className="h-48 w-full resize-none border-none bg-transparent p-4 text-lg text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                    maxLength={4000}
                  />
                  <div className="px-4 pb-3 text-right text-xs text-zinc-400">{input.length} / 4000 chars</div>

                  {attachments.length ? (
                    <div className="flex flex-wrap gap-2 px-4 pb-4">
                      {attachments.map((asset, index) => (
                        <div
                          key={`${asset.name}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <span className="max-w-32 truncate">{asset.name}</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-zinc-500 transition hover:text-zinc-800 dark:hover:text-white"
                            aria-label={`Remove ${asset.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between border-t border-zinc-50 p-2 pt-4 dark:border-zinc-800">
                    <div className="flex gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                        <Paperclip size={16} />
                        Bind
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          onChange={handleAttachmentChange}
                          className="hidden"
                        />
                      </label>
                      <button className="p-2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
                        <HelpCircle size={20} />
                      </button>
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={isLoading || !input.trim()}
                      className={`flex items-center gap-2 rounded-2xl px-8 py-3 font-bold transition-all ${
                        isLoading || !input.trim()
                          ? "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                          : "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      }`}
                    >
                      {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <Search size={20} />
                      )}
                      {isLoading ? "Analyzing..." : "Analyze Trust"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-16 grid w-full max-w-4xl grid-cols-2 gap-8 opacity-50 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 sm:grid-cols-3">
                <div className="flex flex-col items-center gap-2">
                  <ShieldCheck size={24} className="text-zinc-900 dark:text-white" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Pattern Recognition</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ExternalLink size={24} className="text-zinc-900 dark:text-white" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">URL Sandboxing</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Info size={24} className="text-zinc-900 dark:text-white" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Behavioral Score</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <AnalysisResultPanel
              result={result}
              isPro={isPro}
              onUpgrade={() => setShowPaywall(true)}
              onReset={reset}
            />
          )}
        </AnimatePresence>
      </main>

      {!result ? (
        <div className="mx-auto max-w-7xl px-6 pb-20 text-center">
          <p className="text-sm text-zinc-400">
            Free tier: {scanCount}/5 monthly checks used ({freeRemaining} remaining)
          </p>
        </div>
      ) : null}

      <OnboardingFlow open={showOnboarding} onComplete={completeOnboarding} />
      <AuthWindow open={!showOnboarding && showAuth} onComplete={handleAuthComplete} />
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} userId={user?.id} />
      <ProfilePanel
        open={showProfile}
        user={user}
        onClose={() => setShowProfile(false)}
        onLogout={handleLogout}
        onOpenPaywall={() => setShowPaywall(true)}
        onUserUpdate={handleUserUpdate}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
      />
    </div>
  );
}
