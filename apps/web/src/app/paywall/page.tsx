"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { configurePurchases, isRevenueCatConfigured, presentPaywall } from "@/lib/revenuecat";
import { getMe } from "@/lib/api";
import { toast } from "sonner";

const FEATURES = [
  "Unlimited trust scans",
  "Proof Mode risk details",
  "History + PDF export",
  "Priority AI scan throughput"
];

export default function PaywallPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!isRevenueCatConfigured()) return;
      try {
        const me = await getMe().catch(() => null);
        if (me?.user?.id) {
          configurePurchases(me.user.id);
        }
        if (containerRef.current) {
          await presentPaywall(containerRef.current);
        }
      } catch (err: any) {
        toast.error(err?.message || "Could not load paywall.");
      }
    };
    run();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-12 dark:bg-black">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft size={16} />
          Back
        </Link>

        <Card className="rounded-[2rem] border-zinc-100 bg-white p-8 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-3xl font-bold tracking-tight">TrustLens Pro</h1>
          <p className="mt-2 text-zinc-500">Unleash the full power of TrustLens AI.</p>

          <div className="my-6 grid gap-2 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature} className="inline-flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
                <CheckCircle2 size={16} className="text-blue-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {isRevenueCatConfigured() ? (
            <div ref={containerRef} className="min-h-[420px] rounded-2xl border border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900" />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              RevenueCat is not configured. Add{" "}
              <code>NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY</code> and{" "}
              <code>NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID</code>.
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
