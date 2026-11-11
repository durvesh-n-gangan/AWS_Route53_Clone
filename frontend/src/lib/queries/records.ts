"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { recordsApi } from "@/lib/api/records";
import { zoneKeys } from "@/lib/queries/zones";
import type { RecordInput, RecordListParams } from "@/types/api";

export const recordKeys = {
  all: (zoneId: string) => ["records", zoneId] as const,
  list: (zoneId: string, params: RecordListParams) => [...recordKeys.all(zoneId), params] as const,
};

export function useRecords(zoneId: string, params: RecordListParams) {
  return useQuery({
    queryKey: recordKeys.list(zoneId, params),
    queryFn: ({ signal }) => recordsApi.list(zoneId, params, signal),
    placeholderData: keepPreviousData,
  });
}

/** After any record change the zone's record count (detail and list) is stale too. */
function useInvalidateZoneRecords(zoneId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: recordKeys.all(zoneId) }),
      queryClient.invalidateQueries({ queryKey: zoneKeys.detail(zoneId) }),
      queryClient.invalidateQueries({ queryKey: zoneKeys.lists() }),
    ]);
}

export function useCreateRecords(zoneId: string) {
  const invalidate = useInvalidateZoneRecords(zoneId);
  return useMutation({
    mutationFn: (records: RecordInput[]) => recordsApi.create(zoneId, records),
    onSuccess: invalidate,
  });
}

export function useUpdateRecord(zoneId: string) {
  const invalidate = useInvalidateZoneRecords(zoneId);
  return useMutation({
    mutationFn: ({ id, record }: { id: string; record: RecordInput }) =>
      recordsApi.update(zoneId, id, record),
    onSuccess: invalidate,
  });
}

/** Deletes the selected records through the bulk endpoint; failures come back per record. */
export function useDeleteRecords(zoneId: string) {
  const invalidate = useInvalidateZoneRecords(zoneId);
  return useMutation({
    mutationFn: (ids: string[]) => recordsApi.bulkDelete(zoneId, ids),
    onSettled: invalidate,
  });
}
