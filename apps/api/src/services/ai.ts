import { config } from "../config";

export interface AIRequest {
  text: string;
  inputType: "sms" | "email" | "message";
  urls: string[];
  locale: "en" | "hi" | "auto";
  requestId: string;
}

export async function callAI(payload: AIRequest): Promise<any> {
  const url = `${config.AI_SERVICE_URL}/v1/analyze`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AI-TOKEN": config.AI_SERVICE_TOKEN
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service error: ${res.status} ${text}`);
  }

  return res.json();
}
