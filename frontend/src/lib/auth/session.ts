import { ROUTES } from "@/lib/navigation";

/** Must match the backend's COOKIE_NAME setting. */
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "r53_session";

/** Where a signed-in user lands when no (valid) redirect target was requested. */
export const DEFAULT_SIGNED_IN_PATH = ROUTES.hostedZones;

const REDIRECT_BASE = "http://redirect.invalid";
// Control characters (tab, newline, ...) are stripped by URL parsers, which can turn
// "/\t/evil.example" into the protocol-relative "//evil.example".
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Only same-site relative paths are honoured as post-login redirects, so a crafted
 * `?redirect=https://evil.example` link cannot bounce users off-site. The value is resolved
 * the way a browser would and must stay on the same origin.
 */
export function safeRedirectTarget(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARS.test(value)
  ) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  let resolved: URL;
  try {
    resolved = new URL(value, REDIRECT_BASE);
  } catch {
    return DEFAULT_SIGNED_IN_PATH;
  }
  if (resolved.origin !== REDIRECT_BASE || resolved.pathname === ROUTES.login) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/** Full page navigation; also resets all in-memory client state. Mocked in tests. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
