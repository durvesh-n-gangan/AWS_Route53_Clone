import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch, ApiError, buildUrl } from "@/lib/api/client";
import { shouldRetry } from "@/lib/queryClient";

function mockFetch(response: Response | Error) {
  const fn =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildUrl", () => {
  it("prefixes the API base and skips empty query values", () => {
    expect(buildUrl("/hostedzones", { search: "ex", type: "", page: 2, sort: undefined })).toBe(
      "/api/v1/hostedzones?search=ex&page=2",
    );
  });
});

describe("apiFetch", () => {
  it("sends cookies and JSON, and returns the parsed body", async () => {
    const fetchMock = mockFetch(json({ ok: true }));

    await expect(apiFetch("/things", { method: "POST", body: { a: 1 } })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/things");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiFetch("/things/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("turns the backend error format into an ApiError", async () => {
    mockFetch(
      json(
        {
          error: {
            code: "HostedZoneNotEmpty",
            message: "Zone has records.",
            details: { id: "Z1" },
          },
        },
        409,
      ),
    );

    const error = await apiFetch("/hostedzones/Z1", { method: "DELETE" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "HostedZoneNotEmpty",
      message: "Zone has records.",
      details: { id: "Z1" },
    });
  });

  it("still raises an ApiError when the error body is not JSON", async () => {
    mockFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 502, code: "UnknownError" });
  });

  it("reports network failures as status 0", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 0, code: "NetworkError" });
  });
});

describe("shouldRetry", () => {
  it("never retries client errors", () => {
    expect(shouldRetry(0, new ApiError(404, "NotFound", "nope"))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, "Unauthenticated", "nope"))).toBe(false);
  });

  it("retries server and network errors twice", () => {
    const serverError = new ApiError(503, "ServiceUnavailable", "down");
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, serverError)).toBe(true);
    expect(shouldRetry(2, serverError)).toBe(false);
  });
});
