import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/auth/session";
import { ROUTES } from "@/lib/navigation";

/** Queries and mutations may opt out of the global "session expired" redirect. */
interface AuthMeta extends Record<string, unknown> {
  skipUnauthorizedRedirect?: boolean;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: AuthMeta;
    mutationMeta: AuthMeta;
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Client errors (4xx) are final; only network and server errors are retried. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

let signingOut = false;

/**
 * The API said the session is gone (expired or revoked). Clear the cookie, then send the
 * user to the sign-in page, remembering where they were.
 */
export async function signOutExpiredSession(): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  try {
    await authApi.logout();
  } catch {
    // The cookie may already be gone; the redirect below is what matters.
  }
  const here = `${window.location.pathname}${window.location.search}`;
  hardNavigate(`${ROUTES.login}?redirect=${encodeURIComponent(here)}`);
}

export function createQueryClient(onUnauthorized: () => void = signOutExpiredSession) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isUnauthorized(error) && !query.meta?.skipUnauthorizedRedirect) onUnauthorized();
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (isUnauthorized(error) && !mutation.meta?.skipUnauthorizedRedirect) onUnauthorized();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
}
