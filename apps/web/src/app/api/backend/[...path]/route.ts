import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isLocalHost(host: string) {
  const h = host.toLowerCase();
  return h.startsWith("localhost") || h.startsWith("127.0.0.1");
}

function resolveApiBase(req: NextRequest) {
  const explicit = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (explicit) return explicit;
  if (isLocalHost(req.nextUrl.host)) return "http://127.0.0.1:5000";
  return "";
}

function buildTargetUrl(req: NextRequest, path: string[], baseUrl: string) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const joinedPath = path.join("/");
  return `${base}/${joinedPath}${req.nextUrl.search}`;
}

async function proxy(req: NextRequest, path: string[]) {
  const apiBase = resolveApiBase(req);
  if (!apiBase) {
    return NextResponse.json(
      {
        error:
          "Web proxy is not configured. Set API_BASE_URL (recommended) or NEXT_PUBLIC_API_BASE_URL in apps/web."
      },
      { status: 500 }
    );
  }

  const targetUrl = buildTargetUrl(req, path, apiBase);
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
    if (targetUrl.includes("localhost")) {
      try {
        const retryUrl = targetUrl.replace("localhost", "127.0.0.1");
        upstream = await fetch(retryUrl, init);
      } catch {
        return NextResponse.json(
          {
            error:
              "Unable to reach backend API from web proxy. Check apps/api is running and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL is correct."
          },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error:
            "Unable to reach backend API from web proxy. Check apps/api is running and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL is correct."
        },
        { status: 502 }
      );
    }
  }

  if (!upstream) {
    return NextResponse.json(
      {
        error:
          "Unable to reach backend API from web proxy. Check apps/api is running and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL is correct."
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
