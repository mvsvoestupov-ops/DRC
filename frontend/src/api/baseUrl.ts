/** Base URL for API calls. Local Vite always uses `/api` proxy to :10000. */
export function apiBaseUrl(): string {
  if (import.meta.env.DEV) return "/api";
  const raw = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  // Production behind nginx: same-origin /api. Never fall back to localhost
  // (empty VITE_API_URL at build time would break login in the browser).
  return raw || "/api";
}
