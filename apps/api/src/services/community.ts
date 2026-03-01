import { getCollections } from "../db";
import { cosineSimilarity, normalizeEmbedding } from "../utils";

export interface CommunitySignals {
  count: number;
  topMatches: Array<{ id: string; score: number; label: string; type: "report" | "scan" }>;
  cluster: string;
  risk: number;
}

export async function computeCommunitySignals(embedding: number[]): Promise<CommunitySignals> {
  const norm = normalizeEmbedding(embedding);
  const { reports, scans } = await getCollections();

  const reportDocs = await reports.find({}).limit(200).toArray();
  const scanDocs = await scans.find({ embedding: { $exists: true } }).sort({ createdAt: -1 }).limit(300).toArray();

  const scored: Array<{ id: string; score: number; label: string; type: "report" | "scan" }> = [];

  for (const r of reportDocs) {
    const score = cosineSimilarity(norm, r.embedding || []);
    scored.push({ id: r._id.toString(), score, label: r.label, type: "report" });
  }

  for (const s of scanDocs) {
    const label = s.community?.cluster || "scan";
    const score = cosineSimilarity(norm, s.embedding || []);
    scored.push({ id: s._id.toString(), score, label, type: "scan" });
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, 5);
  const threshold = 0.78;
  const strong = topMatches.filter((m) => m.score >= threshold);
  const cluster = strong.length
    ? strong.reduce((acc, m) => {
        acc[m.label] = (acc[m.label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const clusterLabel = Object.keys(cluster).sort((a, b) => (cluster[b] || 0) - (cluster[a] || 0))[0] || "mixed";
  const maxSim = topMatches[0]?.score || 0;
  const risk = Math.max(0, Math.min(1, (maxSim - 0.72) / 0.25));

  return {
    count: scored.length,
    topMatches,
    cluster: clusterLabel,
    risk
  };
}
