import { apiFetch } from "@/lib/api/client";
import type {
  BulkDeleteResult,
  HostedZone,
  HostedZoneCreateInput,
  HostedZoneSummary,
  HostedZoneUpdateInput,
  Page,
  ZoneListParams,
} from "@/types/api";

const path = (id: string) => `/hostedzones/${encodeURIComponent(id)}`;

export const zonesApi = {
  list: (params: ZoneListParams, signal?: AbortSignal) =>
    apiFetch<Page<HostedZoneSummary>>("/hostedzones", { query: { ...params }, signal }),
  get: (id: string, signal?: AbortSignal) => apiFetch<HostedZone>(path(id), { signal }),
  create: (input: HostedZoneCreateInput) =>
    apiFetch<HostedZone>("/hostedzones", { method: "POST", body: input }),
  update: (id: string, input: HostedZoneUpdateInput) =>
    apiFetch<HostedZone>(path(id), { method: "PATCH", body: input }),
  remove: (id: string) => apiFetch<void>(path(id), { method: "DELETE" }),
  bulkDelete: (ids: string[]) =>
    apiFetch<BulkDeleteResult>("/hostedzones/bulk-delete", { method: "POST", body: { ids } }),
};
