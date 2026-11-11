import type { ZoneType } from "@/types/api";

/** The console shows names without the trailing root dot: example.com. -> example.com */
export function displayName(fqdn: string): string {
  return fqdn.endsWith(".") && fqdn.length > 1 ? fqdn.slice(0, -1) : fqdn;
}

export function formatZoneType(type: ZoneType): string {
  return type === "public" ? "Public" : "Private";
}

/** Route 53 shows a dash for empty optional values. */
export function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
