"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  FileUp,
  Link2,
  Share2,
  ShieldCheck,
  Users
} from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

type AnalysisResultPanelProps = {
  result: any;
  isPro: boolean;
  onUpgrade: () => void;
  onReset: () => void;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function AnalysisResultPanel({ result, isPro, onUpgrade, onReset }: AnalysisResultPanelProps) {
  const [displayedScore, setDisplayedScore] = useState(0);
  const [displayedReports, setDisplayedReports] = useState(0);
  const [displayedLikelihood, setDisplayedLikelihood] = useState(0);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const view = useMemo(() => {
    const trustScore = clamp(Number(result?.trustScore ?? result?.score ?? 0));
    const behavioralRiskScore = clamp(Math.round(Number(result?.behavior?.confidence || 0) * 100));
    const proof = Array.isArray(result?.proof) ? result.proof : [];
    const community = result?.community || {};

    const detectedRisks = Array.from(
      new Set(
        proof
          .flatMap((item: any) => [item?.title, ...(Array.isArray(item?.tags) ? item.tags : [])])
          .filter(Boolean)
          .slice(0, 8)
      )
    ) as string[];

    const proofPoints = proof
      .slice(0, 6)
      .map((item: any) => ({
        text: item?.title || "Signal",
        reason: item?.detail || "No detail provided",
        type: item?.severity || "med"
      }));

    const reports = Number(community?.count || 0);
    const likelihood = clamp(Math.round(Number((community?.risk ?? (1 - trustScore / 100)) * 100)));
    const topScore = Number(community?.topMatches?.[0]?.score || 0);
    const confidence = `${clamp(Math.round(topScore * 100))}%`;

    return {
      id: String(result?.scanId || result?.requestId || "report"),
      score: trustScore,
      riskLevel: String(result?.riskLevel || "MEDIUM"),
      summary:
        String(result?.summary || "").trim() ||
        "Risk indicators detected. Verify sender identity and avoid urgent payment/credential requests.",
      behavioralRiskScore,
      analyzedAssets: Number(result?.attachmentsCount || 0),
      detectedRisks,
      proofPoints,
      communitySignals: {
        reports,
        scamLikelihood: likelihood,
        firstSeen: reports > 0 ? "Recently" : "N/A",
        category: community?.cluster || "mixed",
        confidence,
        trend: likelihood >= 60 ? "rising" : likelihood >= 35 ? "stable" : "low"
      }
    };
  }, [result]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDisplayedScore((current) => (current >= view.score ? view.score : current + 2));
      setDisplayedReports((current) => {
        const increment = Math.max(1, Math.ceil((view.communitySignals.reports - current) / 12));
        return current >= view.communitySignals.reports ? view.communitySignals.reports : current + increment;
      });
      setDisplayedLikelihood((current) =>
        current >= view.communitySignals.scamLikelihood ? view.communitySignals.scamLikelihood : current + 2
      );
    }, 35);
    return () => window.clearInterval(interval);
  }, [view]);

  const buildPdf = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const lines = [
      "TrustLens AI - Risk Analysis Report",
      `Report ID: ${view.id}`,
      `Trust Score: ${view.score}/100`,
      `Risk Level: ${view.riskLevel}`,
      `Behavioral Risk Score: ${view.behavioralRiskScore}%`,
      `Analyzed Attachments: ${view.analyzedAssets}`,
      "",
      "Detected Risks:",
      ...(view.detectedRisks.length ? view.detectedRisks.map((risk, i) => `${i + 1}. ${risk}`) : ["1. None"]),
      "",
      "Proof Mode Signals:",
      ...view.proofPoints.map((point: { text: string; reason: string }, i: number) => `${i + 1}. ${point.text} - ${point.reason}`),
      "",
      "Community Intelligence:",
      `Reports: ${view.communitySignals.reports}`,
      `Scam Likelihood: ${view.communitySignals.scamLikelihood}%`,
      `First Seen: ${view.communitySignals.firstSeen}`,
      `Category: ${view.communitySignals.category}`,
      `Cluster Confidence: ${view.communitySignals.confidence}`,
      `Trend: ${view.communitySignals.trend}`,
      "",
      `Summary: ${view.summary}`
    ];

    let y = 16;
    lines.forEach((line) => {
      if (y > 285) {
        pdf.addPage();
        y = 16;
      }
      pdf.setFontSize(line.includes("TrustLens AI") ? 16 : 11);
      pdf.text(line, 14, y);
      y += line === "" ? 5 : 7;
    });
    return pdf;
  };

  const downloadPDF = () => {
    if (!isPro) {
      toast.error("PDF export is available on Pro.");
      onUpgrade();
      return;
    }
    const pdf = buildPdf();
    pdf.save(`TrustLens-Report-${view.id}.pdf`);
  };

  const sharePdf = async () => {
    if (!isPro) {
      toast.error("Sharing PDF is available on Pro.");
      onUpgrade();
      return;
    }
    const pdf = buildPdf();
    const blob = pdf.output("blob");
    const file = new File([blob], `TrustLens-Report-${view.id}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "TrustLens Risk Report",
        text: `Risk result: ${view.riskLevel} (${view.score}/100)`,
        files: [file]
      });
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  };

  const copyReportLink = async () => {
    const reportLink = `${window.location.origin}${window.location.pathname}?report=${view.id}&score=${view.score}&risk=${view.riskLevel}`;
    await navigator.clipboard.writeText(reportLink);
    toast.success("Report link copied.");
  };

  const getScoreColor = () => {
    if (view.score > 80) return "text-emerald-500";
    if (view.score > 50) return "text-yellow-500";
    return "text-rose-500";
  };

  const getRiskBg = () => {
    if (view.score > 80) return "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20";
    if (view.score > 50) return "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20";
    return "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20";
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col items-center rounded-[2.5rem] border p-8 text-center shadow-sm ${getRiskBg()}`}
        >
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="text-zinc-100 dark:text-zinc-800"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={364}
                strokeDashoffset={364 - (364 * displayedScore) / 100}
                className={`${getScoreColor()} transition-all duration-1000 ease-out`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor()}`}>{displayedScore}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Trust Score</span>
            </div>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">{view.riskLevel} RISK DETECTED</h2>
          <p className="max-w-md text-zinc-600 dark:text-zinc-400">{view.summary}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Behavioral risk: {view.behavioralRiskScore}%
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-900/20">
                <ShieldCheck className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <h3 className="text-lg font-bold dark:text-white">Proof Mode (Explainable AI)</h3>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {view.detectedRisks.length ? (
                view.detectedRisks.map((risk, index) => (
                  <span
                    key={`${risk}-${index}`}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {risk}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  No strong signals
                </span>
              )}
            </div>

            {!isPro ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-sm text-zinc-500">Detailed behavioral insights are available for Pro users.</p>
                <button onClick={onUpgrade} className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-bold text-white dark:bg-white dark:text-black">
                  Unlock Proof Mode
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {view.proofPoints.map((point: { text: string; reason: string; type: string }, idx: number) => (
                  <div key={idx} className="flex gap-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                    <AlertCircle className="flex-shrink-0 text-orange-500" size={18} />
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">"{point.text}"</div>
                      <div className="mt-1 text-xs text-zinc-500">{point.reason}</div>
                    </div>
                  </div>
                ))}
                {view.proofPoints.length === 0 ? (
                  <p className="py-4 text-center text-sm italic text-zinc-400">No critical behavioral risks detected.</p>
                ) : null}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-purple-50 p-2 dark:bg-purple-900/20">
                <Users className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
              <h3 className="text-lg font-bold dark:text-white">Community Signals</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <span className="text-sm text-zinc-500">Global Submissions</span>
                <span className="text-2xl font-bold dark:text-white">{displayedReports.toLocaleString()}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${displayedLikelihood}%` }} />
              </div>

              <div className="text-sm text-zinc-500">
                Scam likelihood: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{displayedLikelihood}%</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/50">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">First Seen</div>
                  <div className="text-sm font-bold dark:text-white">{view.communitySignals.firstSeen}</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/50">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Category</div>
                  <div className="text-sm font-bold dark:text-white">{view.communitySignals.category}</div>
                </div>
              </div>

              <div className="space-y-1 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
                <div>
                  Cluster confidence: <span className="font-semibold">{view.communitySignals.confidence}</span>
                </div>
                <div>
                  Signal trend: <span className="font-semibold capitalize">{view.communitySignals.trend}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-8 py-4 font-bold text-zinc-900 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
        >
          <ArrowLeft size={18} />
          New Analysis
        </button>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700"
        >
          <FileText size={18} />
          Export Report
        </button>
        <button
          onClick={() => setShowShareOptions((current) => !current)}
          className="rounded-2xl bg-zinc-100 p-4 font-bold text-zinc-900 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
        >
          <Share2 size={20} />
        </button>
      </div>

      {showShareOptions ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-2 max-w-md rounded-3xl border border-zinc-100 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            onClick={sharePdf}
            className="mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <FileUp size={18} />
            Share PDF report
          </button>
          <button
            onClick={copyReportLink}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Link2 size={18} />
            Copy/share report link
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}
