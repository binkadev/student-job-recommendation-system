import { AUTH_TOKEN_STORAGE_KEY } from "../services/api/httpClient";

export function getCurrentUserStorageScope() {
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return "anonymous";
  const [, payload] = token.split(".");
  if (!payload) return token.slice(-16);

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "="))) as Record<string, unknown>;
    const subject = json.sub ?? json.userId ?? json.id ?? json.email;
    return subject ? String(subject) : token.slice(-16);
  } catch {
    return token.slice(-16);
  }
}
