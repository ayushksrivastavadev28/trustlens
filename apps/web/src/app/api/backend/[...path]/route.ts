import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS || 45000);
const PROXY_RETRIES_PER_BASE = Number(process.env.API_PROXY_RETRIES_PER_BASE || 2);

function isLocalHost(host: string) {
  const h = host.toLowerCase();
  return h.startsWith("localhost") || h.startsWith("127.0.0.1");
}

function hasScheme(value: string) {
  return /^https?:\/\//i.test(value);
}

function withScheme(value: string) {
  if (hasScheme(value)) return value;
  if (isLocalHost(value)) return `http://${value}`;
  return `https://${value}`;
}

function buildTargetUrl(req: NextRequest, path: string[], baseUrl: string) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const joinedPath = path.join("/");
  return `${base}/${joinedPath}${req.nextUrl.search}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveApiBaseCandidates(req: NextRequest) {
  const rawEnv = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const rawList = process.env.API_BASE_URLS || "";
  const localFallback = isLocalHost(req.nextUrl.host) ? "http://127.0.0.1:5000" : "";
  const fromList = rawList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(withScheme);

  if (!rawEnv && fromList.length === 0) return localFallback ? [localFallback] : [];

  const raw = rawEnv.trim();
  const candidates: string[] = [];
  if (raw) candidates.push(withScheme(raw));
  candidates.push(...fromList);

  // Recovery path: users sometimes set Railway private DNS in Vercel env.
  // Example: trustlensapi.railway.internal -> try generated public candidates too.
  if (raw.endsWith(".railway.internal")) {
    const service = raw.replace(".railway.internal", "").trim();
    if (service) {
      candidates.push(`https://${service}.up.railway.app`);
      candidates.push(`https://${service}-production.up.railway.app`);
      candidates.push(`http://${raw}`);
    }
  }

  if (localFallback) candidates.push(localFallback);
  return unique(candidates);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROXY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function proxy(req: NextRequest, path: string[]) {
  const candidates = resolveApiBaseCandidates(req);
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "Web proxy is not configured. Set API_BASE_URL (recommended) or NEXT_PUBLIC_API_BASE_URL in apps/web."
      },
      { status: 500 }
    );
  }
  const headers = new Headers();
  const passthrough = ["authorization", "content-type", "cookie", "user-agent", "accept"];
  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();
    if (passthrough.includes(lower) || lower.startsWith("x-")) {
      headers.set(key, value);
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual"
  };

  if (BODY_METHODS.has(req.method)) {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  let upstream: Response | null = null;
  const tried: string[] = [];
  for (const base of candidates) {
    const targetUrl = buildTargetUrl(req, path, base);
    tried.push(targetUrl);
    for (let attempt = 1; attempt <= PROXY_RETRIES_PER_BASE; attempt += 1) {
      try {
        upstream = await fetchWithTimeout(targetUrl, init);
        break;
      } catch {
        if (attempt < PROXY_RETRIES_PER_BASE) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }
    if (upstream) {
      break;
    }
  }

  if (upstream === null) {
    return NextResponse.json(
      {
        error:
          "Unable to reach backend API from web proxy. Check apps/api is running and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL is correct.",
        triedBases: tried,
        hint:
          "If deployed on Vercel, set API_BASE_URL to your Railway public URL (https://...up.railway.app), not localhost or railway.internal."
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  const setCookies = (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });

  if (setCookies.length > 0) {
    response.headers.delete("set-cookie");
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }
  }

  return response;
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}
