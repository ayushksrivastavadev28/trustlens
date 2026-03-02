import { randomUUID } from "crypto";

const RISK_TERMS = [
  "otp",
  "urgent",
  "click",
  "verify",
  "payment",
  "upi",
  "kyc",
  "password",
  "internship fee",
  "registration fee",
  "refund",
  "limited time"
];

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cheapEmbedding(text: string, dims = 384): number[] {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    const idx = Math.abs(hash) % dims;
    vec[idx] += 1;
  }
  return normalize(vec);
}

function findHighlights(text: string) {
  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\bOTP\b|one[- ]time password/gi, label: "otp" },
    { regex: /\bUPI\b|upi id|vpa/gi, label: "upi" },
    { regex: /urgent|immediately|act now|limited time|expires/gi, label: "urgency" },
    { regex: /click here|verify now|login now|pay now/gi, label: "action" }
  ];
  const spans: Array<{ start: number; end: number; label: string }> = [];
  for (const p of patterns) {
    let m: RegExpExecArray | null = p.regex.exec(text);
    while (m) {
      spans.push({ start: m.index, end: m.index + m[0].length, label: p.label });
      m = p.regex.exec(text);
    }
  }
  return spans.slice(0, 30);
}

function urlIntel(urls: string[]) {
  const items = urls.slice(0, 5).map((url) => {
    const flags: string[] = [];
    const u = url.toLowerCase();
    if (!u.startsWith("https://")) flags.push("no_https");
    if (u.length > 110) flags.push("long_url");
    if (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(u)) flags.push("ip_url");
    if (u.includes("xn--")) flags.push("punycode");
    if (/(\\.xyz|\\.top|\\.click|\\.rest|\\.work)\\b/.test(u)) flags.push("suspicious_tld");
    return {
      url,
      finalUrl: url,
      redirects: 0,
      https: u.startsWith("https://"),
      domainAgeDays: null as number | null,
      flags
    };
  });
  const avgRisk =
    items.length === 0 ? 0 : items.reduce((acc, item) => acc + clamp(item.flags.length * 0.18), 0) / items.length;
  return { overallRisk: Math.round(avgRisk * 100), items };
}

function labelRisk(label: string, score: number) {
  const l = label.toLowerCase();
  if (l.includes("spam") || l.includes("phish")) return score;
  return 1 - score;
}

function riskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score <= 33) return "HIGH";
  if (score <= 66) return "MEDIUM";
  return "LOW";
}

export function buildFallbackAIResponse(payload: {
  text: string;
  inputType: "sms" | "email" | "message";
  urls: string[];
  locale: "en" | "hi" | "auto";
  requestId?: string;
  reason?: string;
}) {
  const textLower = payload.text.toLowerCase();
  const hitCount = RISK_TERMS.reduce((acc, term) => acc + (textLower.includes(term) ? 1 : 0), 0);
  const rawRisk = clamp(0.15 + 0.12 * hitCount);
  const smsLabel = rawRisk >= 0.5 ? "spam" : "ham";
  const phishLabel = rawRisk >= 0.5 ? "phishing" : "legit";
  const smsScore = rawRisk >= 0.5 ? rawRisk : 1 - rawRisk;
  const phishScore = rawRisk >= 0.5 ? rawRisk : 1 - rawRisk;
  const behaviorConfidence = clamp(0.2 + hitCount * 0.08);
  const tactics = [
    textLower.includes("urgent") ? "urgency" : "",
    textLower.includes("otp") || textLower.includes("password") ? "credential_harvest" : "",
    textLower.includes("payment") || textLower.includes("upi") ? "payment_request" : ""
  ].filter(Boolean);

  const intel = urlIntel(payload.urls);
  const textRisk = (labelRisk(smsLabel, smsScore) + labelRisk(phishLabel, phishScore)) / 2;
  const totalRisk = clamp(0.35 * textRisk + 0.2 * behaviorConfidence + 0.25 * (intel.overallRisk / 100));
  const trustScore = Math.round((1 - totalRisk) * 100);
  const level = riskLevel(trustScore);

  return {
    requestId: payload.requestId || randomUUID(),
    trustScore,
    riskLevel: level,
    summary:
      "AI model service is temporarily unavailable. Showing fallback heuristic analysis so scanning can continue.",
    proof: [
      {
        title: "Fallback mode active",
        detail: payload.reason || "Primary AI service could not be reached.",
        severity: "med" as const,
        tags: ["fallback", "availability"]
      },
      {
        title: "Keyword risk signal",
        detail: `Detected ${hitCount} suspicious keyword patterns in the message.`,
        severity: hitCount >= 4 ? ("high" as const) : ("med" as const),
        tags: ["heuristic", "keywords"]
      }
    ],
    highlights: findHighlights(payload.text),
    behavior: { tactics, confidence: behaviorConfidence },
    urlIntel: intel,
    classifiers: {
      smsSpam: { label: smsLabel, score: smsScore },
      phishingEmail: { label: phishLabel, score: phishScore }
    },
    embedding: cheapEmbedding(payload.text),
    suggestedActions:
      level === "HIGH"
        ? [
            "Do not click links or share OTP/password.",
            "Verify sender using official channel.",
            "Report this message as scam."
          ]
        : ["Verify sender and URL before taking action.", "Use official app/website for account checks."],
    safeRewrite:
      level === "HIGH"
        ? "I cannot verify this request. I will contact the organization through its official website."
        : null
  };
}

