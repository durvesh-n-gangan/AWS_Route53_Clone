import { API_BASE, apiFetch, ApiError } from "@/lib/api/client";
import type { ImportResult } from "@/types/api";

const base = (zoneId: string) => `/hostedzones/${encodeURIComponent(zoneId)}`;

export type ZoneFileSource = { text: string } | { file: File };

export const zoneFilesApi = {
  importZoneFile: (zoneId: string, source: ZoneFileSource, mode: "preview" | "commit") => {
    const form = new FormData();
    if ("file" in source) form.append("file", source.file);
    else form.append("text", source.text);
    return apiFetch<ImportResult>(`${base(zoneId)}/import`, { method: "POST", body: form, query: { mode } });
  },
};

/** Downloads the zone as a BIND or JSON file using the server's suggested file name. */
export async function downloadZoneExport(zoneId: string, format: "bind" | "json"): Promise<void> {
  const response = await fetch(`${API_BASE}${base(zoneId)}/export?format=${format}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(response.status, "ExportFailed", "The zone could not be exported.");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `zone.${format === "json" ? "json" : "zone"}`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
