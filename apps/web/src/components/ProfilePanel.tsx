"use client";

import { AnimatePresence, motion } from "framer-motion";
import { History, LogOut, User } from "lucide-react";
import Link from "next/link";

type ProfileUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
};

type ProfilePanelProps = {
  open: boolean;
  user: ProfileUser | null;
  onClose: () => void;
  onLogout: () => void;
  onOpenPaywall: () => void;
};

export function ProfilePanel({ open, user, onClose, onLogout, onOpenPaywall }: ProfilePanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/40"
            aria-label="Close profile panel"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed right-0 top-0 z-[85] h-full w-full max-w-sm border-l border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-0.5">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-zinc-900">
                  <User size={20} className="text-zinc-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Signed in as</p>
                <p className="font-semibold">{user?.email || "Guest"}</p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Current Plan</div>
              <div className="mt-2 text-xl font-bold">{user?.plan === "pro" ? "Pro" : "Free"}</div>
              {user?.plan !== "pro" ? (
                <button
                  onClick={onOpenPaywall}
                  className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Upgrade to Pro
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Link
                href="/history"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <History size={16} />
                View History
              </Link>
              <Link
                href="/account"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <User size={16} />
                Account Settings
              </Link>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-900/20"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
