const API_BASE = "/api/backend";

async function apiFetch(path: string, options: RequestInit = {}) {
  const endpoint = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
  } catch {
    const err: any = new Error(
      "Failed to connect to TrustLens API. Ensure apps/api is running and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL is correct."
    );
    err.status = 0;
    throw err;
  }

  if (!res.ok) {
    let message = "Request failed";
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const data = await res.json();
        message = data?.error || data?.message || message;
        if (data?.hint) {
          message = `${message} (${data.hint})`;
        }
      } catch {
        // fall through to generic message
      }
    } else {
      const text = await res.text();
      if (text) message = text;
    }
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function register(payload: { email: string; password: string }) {
  return apiFetch("/v1/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export async function login(payload: { email: string; password: string }) {
  return apiFetch("/v1/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export async function firebaseLogin(idToken: string) {
  return apiFetch("/v1/auth/firebase", { method: "POST", body: JSON.stringify({ idToken }) });
}

export async function logout() {
  return apiFetch("/v1/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch("/v1/auth/me");
}

export async function analyze(payload: { text: string; inputType: string; urls: string[] }) {
  return apiFetch("/v1/analyze", { method: "POST", body: JSON.stringify(payload) });
}

export async function getScan(scanId: string) {
  return apiFetch(`/v1/scans/${scanId}`);
}

export async function getHistory() {
  return apiFetch("/v1/history");
}

export async function billingStatus() {
  return apiFetch("/v1/billing/status");
}
