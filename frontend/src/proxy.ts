import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectTarget, SESSION_COOKIE } from "@/lib/auth/session";
import { ROUTES } from "@/lib/navigation";

/**
 * Route protection that runs before any page renders.
 *
 * It only checks that a session cookie is present. Whether the session is still valid
 * is decided by the API: a 401 from /api/v1 signs the user out client-side
 * (lib/queryClient.ts), which clears the cookie and comes back through here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === ROUTES.login) {
    if (!hasSession) return NextResponse.next();
    const target = safeRedirectTarget(searchParams.get("redirect"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!hasSession) {
    const loginUrl = new URL(ROUTES.login, request.url);
    if (pathname !== "/") loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: skip the API proxy, Next.js internals and any file with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
