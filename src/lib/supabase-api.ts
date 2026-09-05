const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://vlvxdtgoonxbiabkcqdp.supabase.co").replace(/\/$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_SGUk0m5rE31s_x-5rxeITA_GUxa1eCx";

export type AuthSessionPayload = { accessToken: string; refreshToken: string; expiresIn: number };

function assertConfigured() {
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase er ikke konfigurert for denne utgaven ennå.");
}

async function jsonRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  assertConfigured();
  const headers = new Headers(init.headers);
  headers.set("apikey", publishableKey);
  headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error_description ?? body?.msg ?? body?.message ?? body?.error ?? "Forespørselen mislyktes.";
    throw Object.assign(new Error(String(message)), { status: response.status });
  }
  return body;
}

function toSession(body: Record<string, unknown>): AuthSessionPayload {
  return {
    accessToken: String(body.access_token ?? ""),
    refreshToken: String(body.refresh_token ?? ""),
    expiresIn: Number(body.expires_in ?? 3600),
  };
}

function credentials(identifier: string, password: string) {
  const value = identifier.trim();
  if (value.includes("@")) return { email: value.toLowerCase(), password };
  const digits = value.replace(/\D/g, "");
  const phone = digits.startsWith("47") ? `+${digits}` : `+47${digits}`;
  return { phone, password };
}

export async function signIn(identifier: string, password: string) {
  const body = await jsonRequest("/auth/v1/token?grant_type=password", {
    method: "POST", body: JSON.stringify(credentials(identifier, password)),
  });
  return toSession(body);
}

export async function signUp(identifier: string, password: string) {
  const body = await jsonRequest("/auth/v1/signup", {
    method: "POST", body: JSON.stringify(credentials(identifier, password)),
  });
  return body.access_token ? toSession(body) : null;
}

export async function refreshSession(refreshToken: string) {
  const body = await jsonRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return toSession(body);
}

export async function signOut(accessToken: string) {
  await jsonRequest("/auth/v1/logout", { method: "POST" }, accessToken);
}

export async function fetchSnapshot<T>(accessToken: string): Promise<T> {
  return jsonRequest("/rest/v1/rpc/season_snapshot", { method: "POST", body: "{}" }, accessToken) as Promise<T>;
}

export async function applyAction(accessToken: string, payload: Record<string, unknown>) {
  return jsonRequest("/rest/v1/rpc/season_action", {
    method: "POST", body: JSON.stringify({ payload }),
  }, accessToken);
}
