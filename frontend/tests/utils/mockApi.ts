import { vi } from "vitest";

export type MockRoute = (init: RequestInit | undefined, url: string) => Response | Promise<Response>;

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const errorResponse = (status: number, code: string, message: string) =>
  jsonResponse({ error: { code, message, details: {} } }, status);

export const DEMO_USER = { username: "admin", account_id: "123456789012" };

/**
 * Replaces global fetch with a router keyed by "METHOD /path" (path without the query
 * string). Unknown requests fail the test loudly.
 */
export function mockApi(routes: Record<string, MockRoute>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.split("?")[0]}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected API call in test: ${key}`);
    return handler(init, url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
