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
  "Unlimited trust scans",
  "Proof Mode details",
  "Community signals + clustering",
  "History + deep result view",
  "PDF export reports"
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-t-[2.5rem] bg-white p-8 pb-10 shadow-2xl dark:bg-zinc-900 sm:rounded-[2.5rem]"
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close paywall"
        >
          <X size={20} />
        </button>

        <div className="mb-7 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">TrustLens Pro</h2>
          <p className="mt-2 text-zinc-500">Unleash the full power of AI security</p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
              <CheckCircle2 className="text-blue-500" size={16} />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-3xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-zinc-500">Monthly Plan</div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                INR 99<span className="ml-1 text-base font-normal text-zinc-500">/mo</span>
              </div>
            </div>
            <div className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              Best Value
            </div>
          </div>
        </div>

        {isRevenueCatConfigured() ? (
          <div ref={paywallRef} className="min-h-[290px] rounded-2xl border border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900" />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
            RevenueCat Web SDK is not configured. Add{" "}
            <code className="font-semibold">NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY</code> and{" "}
            <code className="font-semibold">NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID</code>.
          </div>
        )}

        <p className="mt-5 text-center text-xs text-zinc-400">
          Cancel anytime. Payments are handled securely through RevenueCat.
        </p>
      </motion.div>
    </div>
  );
}
