import { apiFetch } from "@/lib/api/client";
import type { Page, RecordInput, RecordListParams, RecordSet } from "@/types/api";

const base = (zoneId: string) => `/hostedzones/${encodeURIComponent(zoneId)}/records`;

export const recordsApi = {
  list: (zoneId: string, params: RecordListParams, signal?: AbortSignal) =>
    apiFetch<Page<RecordSet>>(base(zoneId), { query: { ...params }, signal }),
  create: (zoneId: string, records: RecordInput[]) =>
    apiFetch<{ items: RecordSet[] }>(base(zoneId), { method: "POST", body: { records } }),
  update: (zoneId: string, recordId: string, record: RecordInput) =>
    apiFetch<RecordSet>(`${base(zoneId)}/${encodeURIComponent(recordId)}`, {
      method: "PUT",
      body: record,
    }),
  remove: (zoneId: string, recordId: string) =>
    apiFetch<void>(`${base(zoneId)}/${encodeURIComponent(recordId)}`, { method: "DELETE" }),
};
