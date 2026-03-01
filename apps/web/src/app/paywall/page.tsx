"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { configurePurchases, presentPaywall } from "@/lib/revenuecat";
import { getMe } from "@/lib/api";

export default function PaywallPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
      const me = await getMe().catch(() => null);
      if (me?.user?.id) {
        configurePurchases(me.user.id);
      }
      if (containerRef.current) {
        await presentPaywall(containerRef.current);
      }
    };
    run();
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Card className="glass p-6 shadow-soft">
          <h1 className="text-2xl font-semibold">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlock unlimited scans, history, and PDF exports.
          </p>
          <div ref={containerRef} className="mt-6 min-h-[420px] rounded-2xl border border-border bg-white/70" />
        </Card>
      </div>
    </main>
  );
}
