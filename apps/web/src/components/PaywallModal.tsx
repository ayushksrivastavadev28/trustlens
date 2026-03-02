"use client";

import { motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { configurePurchases, isRevenueCatConfigured, presentPaywall } from "@/lib/revenuecat";
import { toast } from "sonner";

type PaywallModalProps = {
  open: boolean;
  userId?: string;
  onClose: () => void;
};

const FEATURES = [
  "Unlimited Trust Checks",
  "Proof Mode (Behavioral Insights)",
  "Community Risk Dashboard",
  "Scam Trend Alerts",
  "PDF Safety Reports"
];

export function PaywallModal({ open, userId, onClose }: PaywallModalProps) {
  const paywallRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !paywallRef.current) return;
    if (!isRevenueCatConfigured()) return;

    const run = async () => {
      try {
        configurePurchases(userId);
        await presentPaywall(paywallRef.current!);
      } catch (err: any) {
        toast.error(err?.message || "Failed to open RevenueCat paywall.");
      }
    };
    run();
  }, [open, userId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="relative w-full max-w-lg overflow-hidden rounded-t-[2.5rem] bg-white p-8 pb-12 shadow-2xl dark:bg-zinc-900 sm:rounded-[2.5rem]"
      >
        <div className="absolute right-6 top-6">
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close paywall"
          >
            <X size={24} className="text-zinc-500" />
          </button>
        </div>

        <div className="mb-6 flex justify-center sm:hidden">
          <div className="h-1 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="mb-10 text-center">
          <h2 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">TrustLens Pro</h2>
          <p className="mt-2 text-zinc-500">Unleash the full power of AI security</p>
        </div>

        <div className="mb-10 space-y-4">
          {FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-500" size={22} />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{feature}</span>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-3xl border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-500">Monthly Plan</div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                INR 99<span className="text-lg font-normal text-zinc-400">/mo</span>
              </div>
            </div>
            <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              Best Value
            </div>
          </div>
        </div>

        {isRevenueCatConfigured() ? (
          <div ref={paywallRef} className="min-h-[280px] rounded-2xl border border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900" />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
            RevenueCat Web SDK is not configured. Add{" "}
            <code className="font-semibold">NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY</code> and{" "}
            <code className="font-semibold">NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID</code>.
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          Cancel anytime. Secure payment powered by RevenueCat.
        </p>
      </motion.div>
    </div>
  );
}
