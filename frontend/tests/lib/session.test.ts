import { describe, expect, it } from "vitest";

import { DEFAULT_SIGNED_IN_PATH, safeRedirectTarget } from "@/lib/auth/session";

describe("safeRedirectTarget", () => {
  it.each([
    ["/route53/v2/profiles", "/route53/v2/profiles"],
    ["/route53/v2/hostedzones?page=2", "/route53/v2/hostedzones?page=2"],
  ])("keeps the in-app path %s", (input, expected) => {
    expect(safeRedirectTarget(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["https://evil.example/"],
    ["//evil.example/"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["/login"],
    ["/login?redirect=/x"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["/\u0000/evil.example"],
    ["/\u007f"],
  ])("falls back to hosted zones for %s", (input) => {
    expect(safeRedirectTarget(input)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("rejects a tab that arrives percent-encoded in the query string", () => {
    const value = new URLSearchParams("redirect=/%09/evil.example").get("redirect");
    expect(safeRedirectTarget(value)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("normalises dot segments but stays on the same site", () => {
    expect(safeRedirectTarget("/route53/../route53/v2/hostedzones")).toBe(
      "/route53/v2/hostedzones",
    );
    expect(safeRedirectTarget("/x/../login")).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
