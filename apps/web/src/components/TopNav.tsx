"use client";

import Link from "next/link";
import { Shield, User, Zap } from "lucide-react";

type TopNavProps = {
  isPro: boolean;
  email?: string;
  onOpenPaywall: () => void;
  onOpenProfile: () => void;
};

export function TopNav({ isPro, email, onOpenPaywall, onOpenProfile }: TopNavProps) {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-zinc-100 bg-white/75 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/70">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="text-white" size={18} />
          </div>
          <span className="text-xl font-bold tracking-tight">TrustLens AI</span>
        </div>

        <div className="hidden items-center gap-5 text-sm font-medium text-zinc-500 md:flex">
          <Link href="/" className="transition hover:text-zinc-900 dark:hover:text-white">Home</Link>
          <Link href="/history" className="transition hover:text-zinc-900 dark:hover:text-white">History</Link>
          <Link href="/paywall" className="transition hover:text-zinc-900 dark:hover:text-white">Paywall</Link>
          <Link href="/account" className="transition hover:text-zinc-900 dark:hover:text-white">Account</Link>
        </div>

        <div className="flex items-center gap-3">
          {!isPro ? (
            <button
              onClick={onOpenPaywall}
              className="hidden items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300 sm:inline-flex"
            >
              <Zap size={14} />
              Get Pro
            </button>
          ) : null}
          <button
            onClick={onOpenProfile}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-0.5 transition hover:scale-105"
            aria-label="Open profile panel"
            title={email || "Profile"}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-zinc-900">
              <User className="text-zinc-500" size={18} />
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
