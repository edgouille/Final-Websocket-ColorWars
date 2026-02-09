import type { TeamName } from "../../shared/game";

export type AuthResponse = {
  user: { uid: string; name: string; team: TeamName };
  token: string;
};

export type MeResponse = {
  user: { uid: string; name: string; team: TeamName };
};

export async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export function saveToken(token: string) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function getMe(token: string): Promise<MeResponse> {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }

  return data as MeResponse;
}
