import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildTargetUrl(req: NextRequest, path: string[]) {
  if (!API_BASE) return "";
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const joinedPath = path.join("/");
  return `${base}/${joinedPath}${req.nextUrl.search}`;
}

async function proxy(req: NextRequest, path: string[]) {
  if (!API_BASE) {
    return NextResponse.json(
      { error: "Web proxy is not configured: NEXT_PUBLIC_API_BASE_URL is missing." },
      { status: 500 }
    );
  }

  const targetUrl = buildTargetUrl(req, path);
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

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to reach backend API from web proxy. Check apps/api is running and NEXT_PUBLIC_API_BASE_URL is correct."
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
