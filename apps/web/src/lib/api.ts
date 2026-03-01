const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

async function apiFetch(path: string, options: RequestInit = {}) {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(text || "Request failed");
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
