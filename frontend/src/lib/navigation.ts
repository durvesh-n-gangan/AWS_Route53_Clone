import type { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import type { SideNavigationProps } from "@cloudscape-design/components/side-navigation";

export const CONSOLE_BASE = "/route53/v2";

export const ROUTES = {
  dashboard: `${CONSOLE_BASE}/home`,
  hostedZones: `${CONSOLE_BASE}/hostedzones`,
  createHostedZone: `${CONSOLE_BASE}/hostedzones/create`,
  hostedZone: (id: string) => `${CONSOLE_BASE}/hostedzones/${encodeURIComponent(id)}`,
  editHostedZone: (id: string) => `${CONSOLE_BASE}/hostedzones/${encodeURIComponent(id)}/edit`,
  createRecord: (id: string) =>
    `${CONSOLE_BASE}/hostedzones/${encodeURIComponent(id)}/records/create`,
  healthChecks: `${CONSOLE_BASE}/healthchecks`,
  profiles: `${CONSOLE_BASE}/profiles`,
  trafficPolicies: `${CONSOLE_BASE}/trafficpolicies`,
  resolver: `${CONSOLE_BASE}/resolver`,
  login: "/login",
} as const;

export interface PlaceholderPage {
  title: string;
  /** Side-navigation group the page belongs to, shown as a middle breadcrumb. */
  section?: string;
  description: string;
}

/**
 * Console sections that exist only as "Coming Soon" placeholders, keyed by the path
 * after /route53/v2/. Rendered by app/route53/v2/[...section]/page.tsx.
 */
export const PLACEHOLDER_PAGES: Record<string, PlaceholderPage> = {
  home: {
    title: "Dashboard",
    description: "An overview of your DNS management, traffic management and domain registration.",
  },
  healthchecks: {
    title: "Health checks",
    description: "Monitor the health of your resources and route traffic away from unhealthy ones.",
  },
  profiles: {
    title: "Profiles",
    description: "Share DNS settings such as hosted zones and Resolver rules across many VPCs.",
  },
  cidrcollections: {
    title: "CIDR collections",
    section: "IP-based routing",
    description: "Group client IP ranges to route traffic based on where queries originate.",
  },
  trafficpolicies: {
    title: "Traffic policies",
    section: "Traffic flow",
    description: "Build complex routing configurations with a visual editor.",
  },
  policyrecords: {
    title: "Policy records",
    section: "Traffic flow",
    description: "Apply a traffic policy to a domain name in a hosted zone.",
  },
  "domains/registered": {
    title: "Registered domains",
    section: "Domains",
    description: "Register and manage domain names.",
  },
  "domains/requests": {
    title: "Requests",
    section: "Domains",
    description: "Track the status of domain registration and transfer requests.",
  },
  resolver: {
    title: "Resolver",
    description: "Resolve DNS queries between your VPCs and your network.",
  },
  "resolver/vpcs": {
    title: "VPCs",
    section: "Resolver",
    description: "See which VPCs use Route 53 Resolver.",
  },
  "resolver/inbound-endpoints": {
    title: "Inbound endpoints",
    section: "Resolver",
    description: "Let your network resolve names in your VPCs.",
  },
  "resolver/outbound-endpoints": {
    title: "Outbound endpoints",
    section: "Resolver",
    description: "Forward DNS queries from your VPCs to your network.",
  },
  "resolver/rules": {
    title: "Rules",
    section: "Resolver",
    description: "Choose which domain names are forwarded to which resolvers.",
  },
  "resolver/query-logging": {
    title: "Query logging",
    section: "Resolver",
    description: "Log the DNS queries made from your VPCs.",
  },
  "firewall/rule-groups": {
    title: "Rule groups",
    section: "DNS Firewall",
    description: "Filter outbound DNS traffic from your VPCs.",
  },
  "firewall/domain-lists": {
    title: "Domain lists",
    section: "DNS Firewall",
    description: "Maintain lists of domains for DNS Firewall rules.",
  },
};

const placeholderHref = (key: string) => `${CONSOLE_BASE}/${key}`;

/** The Route 53 console side navigation, in the console's own order. */
export const SIDE_NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: ROUTES.dashboard },
  { type: "link", text: "Hosted zones", href: ROUTES.hostedZones },
  { type: "link", text: "Health checks", href: ROUTES.healthChecks },
  { type: "link", text: "Profiles", href: ROUTES.profiles },
  {
    type: "section",
    text: "IP-based routing",
    items: [{ type: "link", text: "CIDR collections", href: placeholderHref("cidrcollections") }],
  },
  {
    type: "section",
    text: "Traffic flow",
    items: [
      { type: "link", text: "Traffic policies", href: ROUTES.trafficPolicies },
      { type: "link", text: "Policy records", href: placeholderHref("policyrecords") },
    ],
  },
  {
    type: "section",
    text: "Domains",
    items: [
      { type: "link", text: "Registered domains", href: placeholderHref("domains/registered") },
      { type: "link", text: "Requests", href: placeholderHref("domains/requests") },
    ],
  },
  {
    // A link group so the Resolver overview page (an assignment placeholder) is reachable.
    type: "expandable-link-group",
    text: "Resolver",
    href: ROUTES.resolver,
    defaultExpanded: true,
    items: [
      { type: "link", text: "VPCs", href: placeholderHref("resolver/vpcs") },
      { type: "link", text: "Inbound endpoints", href: placeholderHref("resolver/inbound-endpoints") },
      {
        type: "link",
        text: "Outbound endpoints",
        href: placeholderHref("resolver/outbound-endpoints"),
      },
      { type: "link", text: "Rules", href: placeholderHref("resolver/rules") },
      { type: "link", text: "Query logging", href: placeholderHref("resolver/query-logging") },
    ],
  },
  {
    type: "section",
    text: "DNS Firewall",
    items: [
      { type: "link", text: "Rule groups", href: placeholderHref("firewall/rule-groups") },
      { type: "link", text: "Domain lists", href: placeholderHref("firewall/domain-lists") },
    ],
  },
];

function collectHrefs(items: readonly SideNavigationProps.Item[]): string[] {
  return items.flatMap((item) => {
    if (item.type === "link") return [item.href];
    if (item.type === "section" || item.type === "expandable-link-group") {
      return collectHrefs(item.items);
    }
    return [];
  });
}

const NAV_HREFS = collectHrefs(SIDE_NAV_ITEMS);

/** The side-nav link to highlight: the longest link that equals or contains the path. */
export function findActiveHref(pathname: string, hrefs: readonly string[] = NAV_HREFS): string {
  const matches = hrefs.filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? "";
}

const ROOT_CRUMB: BreadcrumbGroupProps.Item = { text: "Route 53", href: ROUTES.dashboard };

/**
 * Builds the console breadcrumbs for a path. `labels` maps dynamic segments (such as a
 * hosted zone ID) to friendly text (the zone name).
 */
export function buildBreadcrumbs(
  pathname: string,
  labels: Readonly<Record<string, string>> = {},
): BreadcrumbGroupProps.Item[] {
  if (!pathname.startsWith(CONSOLE_BASE)) return [ROOT_CRUMB];
  const segments = pathname.slice(CONSOLE_BASE.length).split("/").filter(Boolean);

  if (segments[0] === "hostedzones") {
    const crumbs = [ROOT_CRUMB, { text: "Hosted zones", href: ROUTES.hostedZones }];
    const [, zoneSegment, action, subAction] = segments;
    if (!zoneSegment) return crumbs;
    if (zoneSegment === "create") {
      return [...crumbs, { text: "Create hosted zone", href: ROUTES.createHostedZone }];
    }
    const zoneId = decodeURIComponent(zoneSegment);
    crumbs.push({ text: labels[zoneId] ?? zoneId, href: ROUTES.hostedZone(zoneId) });
    if (action === "edit") {
      crumbs.push({ text: "Edit hosted zone", href: ROUTES.editHostedZone(zoneId) });
    } else if (action === "records" && subAction === "create") {
      crumbs.push({ text: "Create record", href: ROUTES.createRecord(zoneId) });
    }
    return crumbs;
  }

  const key = segments.length === 0 ? "home" : segments.join("/");
  const page = PLACEHOLDER_PAGES[key];
  if (!page) return [ROOT_CRUMB];
  const crumbs = [ROOT_CRUMB];
  if (page.section) crumbs.push({ text: page.section, href: placeholderHref(key) });
  crumbs.push({ text: page.title, href: placeholderHref(key) });
  return crumbs;
}

/** AppLayout content type for a path: tables, forms and detail pages lay out differently. */
export function contentTypeFor(pathname: string): "table" | "form" | "default" {
  if (pathname === ROUTES.hostedZones) return "table";
  if (/\/(create|edit)$/.test(pathname)) return "form";
  return "default";
}
