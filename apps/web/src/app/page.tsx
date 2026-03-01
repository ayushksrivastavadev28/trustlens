"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">TrustLens AI</p>
            <h1 className="mt-4 text-4xl font-serif leading-tight text-foreground sm:text-5xl">
              A clarity engine for suspicious messages and links.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Paste anything and get a Trust Score, risk level, proof cards, and safe actions in seconds.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link href="/analyze">
                <Button size="lg">Start Scan</Button>
              </Link>
              <Link href="/paywall" className="text-sm text-muted-foreground hover:text-foreground">
                View Pro
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="glass p-6 shadow-soft">
              <p className="text-sm text-muted-foreground">Paste a message sample</p>
              <div className="mt-4 rounded-2xl border border-border bg-white/60 p-4 text-sm text-muted-foreground">
                "Urgent: Your account will be suspended. Verify your UPI within 15 minutes to avoid charges."
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust Score</p>
                  <p className="text-3xl font-semibold text-foreground">42</p>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">High Risk</span>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
