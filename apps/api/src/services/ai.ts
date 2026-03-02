import { config } from "../config";

export interface AIRequest {
  text: string;
  inputType: "sms" | "email" | "message";
  urls: string[];
  locale: "en" | "hi" | "auto";
  requestId: string;
}

function hasScheme(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLocalHost(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

function withScheme(value: string): string {
  const raw = value.trim();
  if (!raw) return raw;
  if (hasScheme(raw)) return raw;
  if (isLocalHost(raw)) return `http://${raw}`;
  return `https://${raw}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveAIBaseCandidates(): string[] {
  const raw = config.AI_SERVICE_URL.trim();
  const candidates: string[] = [withScheme(raw)];

  if (raw.endsWith(".railway.internal")) {
    const service = raw.replace(".railway.internal", "").trim();
    if (service) {
      candidates.push(`https://${service}.up.railway.app`);
      candidates.push(`https://${service}-production.up.railway.app`);
      candidates.push(`http://${raw}`);
    }
  }

  if (isLocalHost(raw)) {
    candidates.push(withScheme(raw.replace("localhost", "127.0.0.1")));
  }

  return unique(candidates);
}

export async function callAI(payload: AIRequest): Promise<any> {
  const bases = resolveAIBaseCandidates();

  const doFetch = async (targetUrl: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (config.AI_SERVICE_TOKEN) headers["X-AI-TOKEN"] = config.AI_SERVICE_TOKEN;

      return await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const tried: string[] = [];
  let lastError = "";
  for (const base of bases) {
    const target = `${base.replace(/\/$/, "")}/v1/analyze`;
    tried.push(target);
    try {
      const res = await doFetch(target);
      if (!res.ok) {
        const text = await res.text();
        lastError = `AI service error: ${res.status} ${text}`;
        continue;
      }
      return res.json();
    } catch (err: any) {
      lastError = err?.name === "AbortError" ? "AI service timeout after 90s" : String(err?.message || err);
    }
  }

  throw new Error(`${lastError || "AI service unavailable"} | tried: ${tried.join(", ")}`);
}
