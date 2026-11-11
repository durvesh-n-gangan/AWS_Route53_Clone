import type { HostedZone, HostedZoneSummary, Page } from "@/types/api";

export function zoneSummary(overrides: Partial<HostedZoneSummary> = {}): HostedZoneSummary {
  return {
    id: "ZEXAMPLE000000000001",
    name: "example.com.",
    type: "public",
    comment: "Main site",
    record_count: 2,
    created_by: "Route 53",
    caller_reference: "ref-1",
    created_at: "2026-11-11T10:00:00Z",
    updated_at: "2026-11-11T10:00:00Z",
    ...overrides,
  };
}

export function zoneDetail(overrides: Partial<HostedZone> = {}): HostedZone {
  return {
    ...zoneSummary(),
    name_servers: [
      "ns-1.awsdns-01.com.",
      "ns-2.awsdns-02.net.",
      "ns-3.awsdns-03.org.",
      "ns-4.awsdns-04.co.uk.",
    ],
    tags: [],
    vpcs: [],
    ...overrides,
  };
}

export function page<T>(items: T[], total = items.length, pageNumber = 1, pageSize = 10): Page<T> {
  return { items, total, page: pageNumber, page_size: pageSize };
}
