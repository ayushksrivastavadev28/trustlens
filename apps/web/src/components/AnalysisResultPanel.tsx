"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrustScoreRing } from "@/components/TrustScoreRing";
import { HighlightedText } from "@/components/HighlightedText";
import { ProofCard } from "@/components/ProofCard";
import { UrlIntelList } from "@/components/UrlIntelList";
import { CommunitySignals } from "@/components/CommunitySignals";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useRef } from "react";

type AnalysisResultPanelProps = {
  result: any;
  isPro: boolean;
  onUpgrade: () => void;
  onReset: () => void;
};

export function AnalysisResultPanel({ result, isPro, onUpgrade, onReset }: AnalysisResultPanelProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);

  const trustScore = result?.trustScore ?? 0;
  const riskLevel = result?.riskLevel ?? "MEDIUM";
  const summary = result?.summary ?? "No summary available.";

  const riskBadge =
    riskLevel === "HIGH" ? "bg-rose-100 text-rose-700" : riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";

  const exportPdf = async () => {
    if (!isPro) {
      toast.error("PDF export is a Pro feature.");
      onUpgrade();
      return;
    }
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, { scale: 2 });
    const data = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(data, "PNG", 0, 0, width, height);
    pdf.save(`trustlens-${result.scanId || result.requestId || "report"}.pdf`);
  };

  return (
    <motion.div
      key="results-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-5xl space-y-6"
      ref={exportRef}
    >
      <Card className="rounded-[2rem] border-zinc-100 bg-white p-7 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">TrustLens Result</p>
            <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{riskLevel} Risk Signal</h2>
            <p className="mt-2 max-w-xl text-zinc-500">{summary}</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge className={riskBadge}>{riskLevel}</Badge>
              <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">Trust Score</span>
            </div>
          </div>
          <TrustScoreRing score={trustScore} />
        </div>
      </Card>

      <Card className="rounded-[2rem] border-zinc-100 bg-white p-7 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Highlighted Message</h3>
        <HighlightedText text={result?.input?.text || ""} highlights={result?.highlights || []} />
      </Card>

      <Card className="rounded-[2rem] border-zinc-100 bg-white p-7 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Proof Mode</h3>
          <Button onClick={exportPdf} variant="outline" className="gap-2">
            <FileText size={16} />
            Export Report
          </Button>
        </div>
        {!isPro ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            Detailed proof cards are available on Pro plan.
            <button onClick={onUpgrade} className="ml-2 font-semibold text-blue-600">
              Upgrade
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(result?.proof || []).map((item: any, idx: number) => (
              <ProofCard key={idx} {...item} />
            ))}
          </div>
        )}
      </Card>

      <UrlIntelList intel={result?.urlIntel} />
      <CommunitySignals community={result?.community} />

      <Card className="rounded-[2rem] border-zinc-100 bg-white p-7 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Suggested Actions</h3>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-zinc-600 dark:text-zinc-300">
          {(result?.suggestedActions || []).map((action: string, i: number) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-8">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-6 py-3 font-semibold text-zinc-900 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
        >
          <ArrowLeft size={16} />
          New Analysis
        </button>
        {result?.scanId ? (
          <Link
            href={`/result/${result.scanId}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Open Full Result Page
            <ExternalLink size={16} />
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}
