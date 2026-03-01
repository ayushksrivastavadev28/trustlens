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

  const doFetch = async (targetUrl: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      return await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-TOKEN": config.AI_SERVICE_TOKEN
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let res: Response;
  try {
    res = await doFetch(url);
  } catch (err) {
    if (config.AI_SERVICE_URL.includes("localhost")) {
      const retryUrl = `${config.AI_SERVICE_URL.replace("localhost", "127.0.0.1")}/v1/analyze`;
      res = await doFetch(retryUrl);
    } else {
      throw err;
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service error: ${res.status} ${text}`);
  }
  return res.json();
}
