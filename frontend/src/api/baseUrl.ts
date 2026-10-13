/** Base URL for API calls. Local Vite always uses `/api` proxy to :10000. */
export function apiBaseUrl(): string {
  if (import.meta.env.DEV) return "/api";
  const raw = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  return raw || "http://127.0.0.1:10000";
}
