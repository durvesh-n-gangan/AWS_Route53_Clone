import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbs,
  findActiveHref,
  PLACEHOLDER_PAGES,
  ROUTES,
  SIDE_NAV_ITEMS,
} from "@/lib/navigation";

const texts = (pathname: string, labels?: Record<string, string>) =>
  buildBreadcrumbs(pathname, labels).map((crumb) => crumb.text);

describe("buildBreadcrumbs", () => {
  it("starts every console page with Route 53", () => {
    expect(texts("/route53/v2/home")).toEqual(["Route 53", "Dashboard"]);
  });

  it("reads Route 53 › Hosted zones › zone name for a zone page", () => {
    expect(texts("/route53/v2/hostedzones/Z123", { Z123: "example.com" })).toEqual([
      "Route 53",
      "Hosted zones",
      "example.com",
    ]);
  });

  it("falls back to the zone ID until the zone name is known", () => {
    expect(texts("/route53/v2/hostedzones/Z123")).toEqual(["Route 53", "Hosted zones", "Z123"]);
  });

  it.each([
    ["/route53/v2/hostedzones", ["Route 53", "Hosted zones"]],
    ["/route53/v2/hostedzones/create", ["Route 53", "Hosted zones", "Create hosted zone"]],
    ["/route53/v2/hostedzones/Z1/edit", ["Route 53", "Hosted zones", "Z1", "Edit hosted zone"]],
    [
      "/route53/v2/hostedzones/Z1/records/create",
      ["Route 53", "Hosted zones", "Z1", "Create record"],
    ],
    ["/route53/v2/resolver/rules", ["Route 53", "Resolver", "Rules"]],
    ["/route53/v2/trafficpolicies", ["Route 53", "Traffic flow", "Traffic policies"]],
  ])("builds %s", (pathname, expected) => {
    expect(texts(pathname)).toEqual(expected);
  });

  it("links each crumb to its page", () => {
    const crumbs = buildBreadcrumbs("/route53/v2/hostedzones/Z1/edit");
    expect(crumbs.map((crumb) => crumb.href)).toEqual([
      ROUTES.dashboard,
      ROUTES.hostedZones,
      ROUTES.hostedZone("Z1"),
      ROUTES.editHostedZone("Z1"),
    ]);
  });
});

describe("findActiveHref", () => {
  it("highlights the exact link", () => {
    expect(findActiveHref("/route53/v2/healthchecks")).toBe(ROUTES.healthChecks);
  });

  it("highlights Hosted zones on any page under it", () => {
    expect(findActiveHref("/route53/v2/hostedzones/Z1/records/create")).toBe(ROUTES.hostedZones);
  });

  it("prefers the longest matching link", () => {
    expect(findActiveHref("/a/b/c", ["/a", "/a/b"])).toBe("/a/b");
  });

  it("does not match on a shared prefix that is not a path segment", () => {
    expect(findActiveHref("/route53/v2/hostedzonesX", [ROUTES.hostedZones])).toBe("");
  });
});

describe("side navigation and placeholders", () => {
  it("lists the main Route 53 sections in console order", () => {
    expect(SIDE_NAV_ITEMS.map((item) => ("text" in item ? item.text : ""))).toEqual([
      "Dashboard",
      "Hosted zones",
      "Health checks",
      "Profiles",
      "IP-based routing",
      "Traffic flow",
      "Domains",
      "Resolver",
      "DNS Firewall",
    ]);
  });

  it("has a Coming Soon page for every mocked section in the assignment", () => {
    for (const key of ["home", "trafficpolicies", "healthchecks", "resolver", "profiles"]) {
      expect(PLACEHOLDER_PAGES[key]).toBeDefined();
    }
  });
});
