"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getScan, getMe, billingStatus } from "@/lib/api";
import { TrustScoreRing } from "@/components/TrustScoreRing";
import { ProofCard } from "@/components/ProofCard";
import { UrlIntelList } from "@/components/UrlIntelList";
import { CommunitySignals } from "@/components/CommunitySignals";
import { HighlightedText } from "@/components/HighlightedText";
import { configurePurchases, getClientProStatus } from "@/lib/revenuecat";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const scanId = useMemo(() => params?.scanId as string, [params]);

  useEffect(() => {
    const run = async () => {
      try {
        const me = await getMe();
        if (me?.user?.id) {
          configurePurchases(me.user.id);
        }
        const [scanRes, serverPro] = await Promise.all([getScan(scanId), billingStatus().catch(() => null)]);
        setScan(scanRes.scan);
        const clientPro = await getClientProStatus();
        setIsPro(Boolean(clientPro || serverPro?.isPro));
      } catch (err: any) {
        if (err?.status === 401) {
          router.push("/account");
        } else {
          toast.error(err?.message || "Failed to load scan");
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [scanId, router]);

  const exportPdf = async () => {
    if (!isPro) {
      toast.error("Pro required to export PDF");
      return;
    }
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save(`trustlens-${scanId}.pdf`);
  };

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <Card className="glass p-6 shadow-soft">Loading scan...</Card>
        </div>
      </main>
    );
  }

  if (!scan) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <Card className="glass p-6 shadow-soft">Scan not found.</Card>
        </div>
      </main>
    );
  }

  const ai = scan.ai || scan;
  const displayedTrustScore = scan.trustScore ?? ai.trustScore ?? 0;
  const displayedRiskLevel = scan.riskLevel ?? ai.riskLevel ?? "MEDIUM";
  const displayedSummary = ai.summary || "No summary available for this scan.";
  const displayedProof = ai.proof || [];
  const displayedHighlights = ai.highlights || [];
  const displayedUrlIntel = ai.urlIntel || { overallRisk: 0, items: [] };
  const displayedActions = ai.suggestedActions || [];

  const riskBadge =
    displayedRiskLevel === "HIGH"
      ? "bg-red-100 text-red-600"
      : displayedRiskLevel === "MEDIUM"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6" ref={exportRef}>
        <Card className="glass p-6 shadow-soft">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">TrustLens Result</h1>
              <p className="mt-2 text-sm text-muted-foreground">Request ID: {scan.requestId || ai.requestId || "n/a"}</p>
              <div className="mt-4 flex items-center gap-2">
                <Badge className={riskBadge}>{displayedRiskLevel} Risk</Badge>
                <span className="text-sm text-muted-foreground">Trust Score</span>
              </div>
            </div>
            <TrustScoreRing score={displayedTrustScore} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{displayedSummary}</p>
        </Card>

        <Card className="glass p-6 shadow-soft">
          <h2 className="text-lg font-semibold">Highlighted Message</h2>
          <HighlightedText text={scan.input?.text || ""} highlights={displayedHighlights} />
        </Card>

        <Card className="glass p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Proof Mode</h2>
            <Button variant="outline" onClick={exportPdf}>Export PDF</Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {displayedProof.map((item: any, idx: number) => (
              <ProofCard key={idx} {...item} />
            ))}
          </div>
        </Card>

        <UrlIntelList intel={displayedUrlIntel} />
        <CommunitySignals community={scan.community} />

        <Card className="glass p-6 shadow-soft">
          <h2 className="text-lg font-semibold">Suggested Actions</h2>
          <ul className="mt-3 list-disc pl-6 text-sm text-muted-foreground">
            {displayedActions.map((a: string, i: number) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
