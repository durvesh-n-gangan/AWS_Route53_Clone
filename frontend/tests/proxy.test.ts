// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

const BASE = "http://localhost:3000";

function request(path: string, withSession: boolean) {
  const req = new NextRequest(new URL(path, BASE));
  if (withSession) req.cookies.set("r53_session", "token-value");
  return req;
}

const location = (response: Response) => response.headers.get("location");

describe("proxy route protection", () => {
  it("sends a signed-out user to sign-in and remembers the page", () => {
    const response = proxy(request("/route53/v2/hostedzones?page=2", false));

    expect(response.status).toBe(307);
    const target = new URL(location(response)!);
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("redirect")).toBe("/route53/v2/hostedzones?page=2");
  });

  it("does not add a redirect parameter for the site root", () => {
    const response = proxy(request("/", false));
    expect(location(response)).toBe(`${BASE}/login`);
  });

  it("lets a signed-out user see the sign-in page", () => {
    const response = proxy(request("/login", false));
    expect(location(response)).toBeNull();
  });

  it("sends a signed-in user away from sign-in to hosted zones", () => {
    const response = proxy(request("/login", true));
    expect(location(response)).toBe(`${BASE}/route53/v2/hostedzones`);
  });

  it("honours a safe redirect parameter for a signed-in user on sign-in", () => {
    const response = proxy(request("/login?redirect=%2Froute53%2Fv2%2Fprofiles", true));
    expect(location(response)).toBe(`${BASE}/route53/v2/profiles`);
  });

  it("ignores an off-site redirect parameter", () => {
    const response = proxy(request("/login?redirect=https%3A%2F%2Fevil.example", true));
    expect(location(response)).toBe(`${BASE}/route53/v2/hostedzones`);
  });

  it("lets a signed-in user through to console pages", () => {
    const response = proxy(request("/route53/v2/home", true));
    expect(location(response)).toBeNull();
  });
});

describe("proxy matcher", () => {
  it.each([
    ["/route53/v2/hostedzones", true],
    ["/login", true],
    ["/", true],
    ["/api/v1/health", false],
    ["/_next/static/chunks/main.js", false],
    ["/favicon.ico", false],
  ])("matches %s: %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});
