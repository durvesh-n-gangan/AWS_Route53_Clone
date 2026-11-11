import { ROUTES } from "@/lib/navigation";

/** Must match the backend's COOKIE_NAME setting. */
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "r53_session";

/** Where a signed-in user lands when no (valid) redirect target was requested. */
export const DEFAULT_SIGNED_IN_PATH = ROUTES.hostedZones;

/**
 * Only same-site relative paths are honoured as post-login redirects, so a crafted
 * `?redirect=https://evil.example` link cannot bounce users off-site.
 */
export function safeRedirectTarget(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  if (value === ROUTES.login || value.startsWith(`${ROUTES.login}?`)) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  return value;
}

/** Full page navigation; also resets all in-memory client state. Mocked in tests. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
