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
  ])("falls back to hosted zones for %s", (input) => {
    expect(safeRedirectTarget(input)).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
