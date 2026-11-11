import type { ApiErrorBody } from "@/types/api";

/**
 * The browser always calls the API on its own origin; next.config.ts rewrites /api/* to the
 * FastAPI backend. That keeps the session cookie first-party in every environment.
 */
export const API_BASE = "/api/v1";

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body; a FormData body is sent as multipart instead. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/** A failed API call, carrying the backend's error code and details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ""}`;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      // For FormData the browser sets the multipart Content-Type (with its boundary) itself.
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "NetworkError", "Unable to reach the server. Check your connection.");
  }

  if (response.status === 204) return undefined as T;
  const payload = await readJson(response);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      const { code, message, details } = payload.error;
      throw new ApiError(response.status, code, message, details ?? {});
    }
    throw new ApiError(response.status, "UnknownError", `Request failed (${response.status}).`);
  }
  return payload as T;
}
