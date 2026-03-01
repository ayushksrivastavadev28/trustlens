export interface AnalyzeInput {
  text: string;
  inputType: "sms" | "email" | "message";
  urls: string[];
}

export interface AnalyzeResponse {
  scanId: string;
  trustScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  proof: Array<{ title: string; detail: string; severity: "low" | "med" | "high"; tags: string[] }>;
  highlights: Array<{ start: number; end: number; label: string }>;
  behavior: { tactics: string[]; confidence: number };
  urlIntel: any;
  classifiers: any;
  embedding: number[];
  suggestedActions: string[];
  safeRewrite: string | null;
  community: any;
}
