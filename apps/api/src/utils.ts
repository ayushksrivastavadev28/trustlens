import { ObjectId } from "mongodb";

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeEmbedding(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let aSum = 0;
  let bSum = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aSum += a[i] * a[i];
    bSum += b[i] * b[i];
  }
  const denom = Math.sqrt(aSum) * Math.sqrt(bSum) || 1;
  return dot / denom;
}

export function labelToRisk(label: string, score: number): number {
  const l = label.toLowerCase();
  const risky = ["spam", "phish", "malicious", "fraud", "scam", "yes", "label_1"].some((t) => l.includes(t));
  const safe = ["ham", "legit", "no", "label_0"].some((t) => l.includes(t));
  if (risky) return score;
  if (safe) return 1 - score;
  return score;
}

export function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score <= 33) return "HIGH";
  if (score <= 66) return "MEDIUM";
  return "LOW";
}

export function computeTrustScore(params: {
  textRisk: number;
  behaviorRisk: number;
  urlRisk: number;
  communityRisk: number;
}): number {
  const weighted = 0.35 * params.textRisk + 0.2 * params.behaviorRisk + 0.25 * params.urlRisk + 0.2 * params.communityRisk;
  const trust = Math.max(0, Math.min(1, 1 - weighted));
  return Math.round(trust * 100);
}

export function sanitizeUrls(urls: string[], limit = 5): string[] {
  const cleaned: string[] = [];
  for (const raw of urls) {
    if (cleaned.length >= limit) break;
    try {
      const url = new URL(raw.trim());
      if (!/^https?:$/.test(url.protocol)) continue;
      cleaned.push(url.toString());
    } catch {
      continue;
    }
  }
  return cleaned;
}

export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}
