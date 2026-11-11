"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { zonesApi } from "@/lib/api/zones";
import type { HostedZoneUpdateInput, ZoneListParams } from "@/types/api";

export const zoneKeys = {
  all: ["zones"] as const,
  lists: () => [...zoneKeys.all, "list"] as const,
  list: (params: ZoneListParams) => [...zoneKeys.lists(), params] as const,
  detail: (id: string) => [...zoneKeys.all, "detail", id] as const,
};

export function useZones(params: ZoneListParams) {
  return useQuery({
    queryKey: zoneKeys.list(params),
    queryFn: ({ signal }) => zonesApi.list(params, signal),
    // Keep showing the current page while the next one loads, like the console does.
    placeholderData: keepPreviousData,
  });
}

export function useZone(id: string) {
  return useQuery({
    queryKey: zoneKeys.detail(id),
    queryFn: ({ signal }) => zonesApi.get(id, signal),
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: zonesApi.create,
    onSuccess: (zone) => {
      queryClient.setQueryData(zoneKeys.detail(zone.id), zone);
      return queryClient.invalidateQueries({ queryKey: zoneKeys.lists() });
    },
  });
}

export function useUpdateZone(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HostedZoneUpdateInput) => zonesApi.update(id, input),
    onSuccess: (zone) => {
      queryClient.setQueryData(zoneKeys.detail(id), zone);
      return queryClient.invalidateQueries({ queryKey: zoneKeys.lists() });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: zonesApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: zoneKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: zoneKeys.lists() });
    },
  });
}
