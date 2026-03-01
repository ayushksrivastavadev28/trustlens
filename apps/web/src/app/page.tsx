"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, HelpCircle, Info, Paperclip, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type Attachment = {
  name: string;
  size: number;
  type: string;
};

const ONBOARDING_KEY = "trustlens_onboarding_done";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const [inputType, setInputType] = useState<"message" | "sms" | "email">("message");
  const [text, setText] = useState("");
  const [urls, setUrls] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY) === "true";
    setShowOnboarding(!hasCompletedOnboarding);

    const loadSession = async () => {
      const me = await getMe().catch(() => null);
      if (me?.user) {
        setUser(me.user);
        configurePurchases(me.user.id);
        const [serverBilling, clientPro] = await Promise.all([billingStatus().catch(() => null), getClientProStatus()]);
        setIsPro(Boolean(clientPro || serverBilling?.isPro || me.user.plan === "pro"));
      } else if (hasCompletedOnboarding) {
        setShowAuth(true);
      }
    };
    loadSession();
  }, []);

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const mapped = files.map((file) => ({ name: file.name, size: file.size, type: file.type || "application/octet-stream" }));
    setAttachments((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast.error("Paste some content to analyze.");
      return;
    }
    if (!user) {
      setShowAuth(true);
      return;
    }

    setIsLoading(true);
    try {
      const parsedUrls = urls
        .split(/\n|,/)
        .map((u) => u.trim())
        .filter(Boolean);

      const res = await analyze({
        text,
        inputType,
        urls: parsedUrls
      });
      setResult({
        ...res,
        input: {
          text,
          inputType,
          urls: parsedUrls
        }
      });
      setScanCount((v) => v + 1);
      if (user && res?.scanId) {
        router.prefetch(`/result/${res.scanId}`);
      }
    } catch (err: any) {
      if (err?.status === 401) {
        setUser(null);
        setShowAuth(true);
        toast.error("Session expired. Please sign in again.");
      } else if (err?.status === 402) {
        setShowPaywall(true);
        toast.error("Free scan limit reached. Upgrade to Pro.");
      } else {
        toast.error(err?.message || "Scan failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
    if (!user) setShowAuth(true);
  };

  const handleAuthComplete = async (sessionUser: SessionUser) => {
    setUser(sessionUser);
    setShowAuth(false);
    configurePurchases(sessionUser.id);
    const [serverBilling, clientPro] = await Promise.all([billingStatus().catch(() => null), getClientProStatus()]);
    setIsPro(Boolean(clientPro || serverBilling?.isPro || sessionUser.plan === "pro"));
  };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setUser(null);
    setIsPro(false);
    setShowProfile(false);
    setShowAuth(true);
    setResult(null);
    setText("");
    setUrls("");
    setAttachments([]);
  };

  const score = result?.trustScore ?? 0;
  const scoreTone =
    score > 80 ? "text-emerald-500" : score > 50 ? "text-amber-500" : "text-rose-500";

  const freeRemaining = useMemo(() => Math.max(0, 5 - scanCount), [scanCount]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 dark:bg-black dark:text-zinc-100">
      <TopNav
        isPro={isPro}
        email={user?.email}
        onOpenPaywall={() => setShowPaywall(true)}
        onOpenProfile={() => setShowProfile(true)}
      />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="input-stage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-12 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:bg-zinc-800">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Real-Time Security
                </div>
                <h1 className="bg-gradient-to-b from-zinc-900 to-zinc-500 bg-clip-text pb-1 text-5xl font-bold tracking-tight text-transparent dark:from-white dark:to-zinc-500 sm:text-7xl">
                  Decide Before You Trust
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-zinc-500 sm:text-xl">
                  Analyze messages, emails, and links with AI-powered trust scoring, proof mode, and community signals.
                </p>
              </div>

              <div className="relative w-full max-w-3xl">
                <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10 blur" />
                <div className="relative rounded-[2.5rem] border border-zinc-100 bg-white p-4 shadow-xl shadow-zinc-200/50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                  <div className="mb-3 flex flex-wrap items-center gap-2 px-2">
                    {(["message", "sms", "email"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setInputType(type)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                          inputType === type
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste suspicious text/email/link message..."
                    className="h-44 w-full resize-none border-none bg-transparent p-4 text-lg outline-none placeholder:text-zinc-400"
                    maxLength={5000}
                  />
                  <div className="px-4 pb-3 text-right text-xs text-zinc-400">{text.length} / 5000 chars</div>

                  <div className="px-4 pb-3">
                    <input
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      placeholder="Optional URLs (comma or newline separated)"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 px-4 pb-4">
                      {attachments.map((asset, index) => (
                        <div key={`${asset.name}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs dark:bg-zinc-800">
                          <span className="max-w-36 truncate">{asset.name}</span>
                          <button onClick={() => removeAttachment(index)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between border-t border-zinc-100 p-2 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
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
                      <button className="rounded-lg p-2 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300">
                        <HelpCircle size={18} />
                      </button>
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={isLoading || !text.trim()}
                      className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3 font-bold transition ${
                        isLoading || !text.trim()
                          ? "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                          : "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      }`}
                    >
                      {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Search size={20} />}
                      {isLoading ? "Analyzing..." : "Analyze Trust"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-12 grid w-full max-w-4xl grid-cols-2 gap-8 opacity-80 transition md:grid-cols-3">
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <ShieldCheck size={24} className={scoreTone} />
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">Pattern Recognition</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <ExternalLink size={24} className="text-zinc-700 dark:text-zinc-200" />
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">URL Sandboxing</span>
                </div>
                <div className="col-span-2 flex flex-col items-center gap-2 text-zinc-500 md:col-span-1">
                  <Info size={24} className="text-zinc-700 dark:text-zinc-200" />
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">Behavioral Score</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <AnalysisResultPanel
              key="result-stage"
              result={result}
              isPro={isPro}
              onUpgrade={() => setShowPaywall(true)}
              onReset={() => {
                setResult(null);
                setText("");
                setUrls("");
                setAttachments([]);
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {!result ? (
        <div className="pb-12 text-center text-sm text-zinc-400">
          Free tier: {isPro ? "Unlimited scans (Pro)" : `${scanCount}/5 scans used (${freeRemaining} remaining in this session)`}
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
      />
    </div>
  );
}
