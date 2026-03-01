"use client";

import { motion } from "framer-motion";

export function TrustScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const angle = (clamped / 100) * 360;
  const bg = `conic-gradient(hsl(var(--primary)) ${angle}deg, rgba(15, 23, 42, 0.08) 0deg)`;

  return (
    <div className="flex items-center gap-4">
      <motion.div
        className="flex h-28 w-28 items-center justify-center rounded-full shadow-glow"
        style={{ background: bg }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-xl font-semibold">
          {clamped}
        </div>
      </motion.div>
    </div>
  );
}
