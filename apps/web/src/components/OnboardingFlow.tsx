"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Shield, Users, Zap } from "lucide-react";
import { useState } from "react";

type OnboardingFlowProps = {
  open: boolean;
  onComplete: () => void;
};

const SLIDES = [
  {
    icon: Zap,
    title: "Real-Time Trust Evaluation",
    description: "Drop any message or link and get an instant trust score with explainable AI signals.",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    icon: Shield,
    title: "Proof Mode Explanations",
    description: "Understand why content is risky using proof cards, tactics detection, and URL intelligence.",
    gradient: "from-emerald-500 to-teal-500"
  },
  {
    icon: Users,
    title: "Community Intelligence",
    description: "Match suspicious patterns against community reports and historical scans for better decisions.",
    gradient: "from-purple-500 to-pink-500"
  }
];

export function OnboardingFlow({ open, onComplete }: OnboardingFlowProps) {
  const [index, setIndex] = useState(0);

  if (!open) return null;

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-[90] bg-white dark:bg-zinc-950">
      <div className="absolute inset-x-0 top-0 z-10 p-6">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">TrustLens AI</span>
          </div>
          <button
            onClick={onComplete}
            className="text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Skip
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 top-24 z-10 px-6">
        <div className="mx-auto flex max-w-md justify-center gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-8 bg-blue-600" : "w-2 bg-zinc-300 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex h-screen flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.28 }}
            className="max-w-md text-center"
          >
            <div
              className={`mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br ${slide.gradient} shadow-2xl`}
            >
              <Icon className="text-white" size={48} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">{slide.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">{slide.description}</p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-16 flex gap-4"
        >
          {index > 0 ? (
            <button
              onClick={() => setIndex((v) => v - 1)}
              className="rounded-full border border-zinc-200 px-6 py-3 font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
          ) : null}
          <button
            onClick={() => {
              if (index >= SLIDES.length - 1) onComplete();
              else setIndex((v) => v + 1);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {index >= SLIDES.length - 1 ? "Get Started" : "Next"}
            <ChevronRight size={18} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
