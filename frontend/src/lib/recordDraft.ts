import { displayName } from "@/lib/format";
import { MAX_TTL } from "@/lib/recordTypes";
import type { RecordInput, RecordSet, RecordType } from "@/types/api";

/** What the record form edits: text fields exactly as typed. */
export interface RecordDraft {
  /** Relative to the zone ("www"); empty means the zone apex. */
  name: string;
  type: RecordType;
  ttl: string;
  /** One value per line. */
  value: string;
}

export type RecordField = "name" | "type" | "ttl" | "values";
export type RecordErrors = Partial<Record<RecordField, string>>;

export function newDraft(): RecordDraft {
  return { name: "", type: "A", ttl: "300", value: "" };
}

/** Converts a stored record (FQDN names) back into a form draft (zone-relative name). */
export function toDraft(record: RecordSet, zoneName: string): RecordDraft {
  const zone = zoneName.endsWith(".") ? zoneName : `${zoneName}.`;
  const relative =
    record.name === zone ? "" : record.name.endsWith(`.${zone}`) ? record.name.slice(0, -(zone.length + 1)) : displayName(record.name);
  return { name: relative, type: record.type, ttl: String(record.ttl), value: record.values.join("\n") };
}

export function draftValues(draft: RecordDraft): string[] {
  return draft.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function toInput(draft: RecordDraft): RecordInput {
  return {
    name: draft.name.trim(),
    type: draft.type,
    ttl: Number(draft.ttl),
    values: draftValues(draft),
    routing_policy: "simple",
  };
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Quick checks for instant feedback; the backend performs the full validation. */
export function validateDraft(draft: RecordDraft): RecordErrors {
  const errors: RecordErrors = {};
  const ttl = draft.ttl.trim();
  if (!/^\d+$/.test(ttl) || Number(ttl) > MAX_TTL) {
    errors.ttl = `Enter a whole number of seconds from 0 to ${MAX_TTL}.`;
  }
  const values = draftValues(draft);
  if (values.length === 0) {
    errors.values = "Enter a value.";
    return errors;
  }
  if (draft.type === "CNAME" && values.length > 1) {
    errors.values = "A CNAME record can have only one value.";
  } else if (draft.type === "A") {
    const bad = values.find((value) => !IPV4.test(value));
    if (bad) errors.values = `${bad} is not a valid IPv4 address, such as 192.0.2.235.`;
  } else if (draft.type === "AAAA") {
    const bad = values.find((value) => !value.includes(":"));
    if (bad) errors.values = `${bad} is not a valid IPv6 address, such as 2001:db8::1.`;
  } else if (draft.type === "MX") {
    const bad = values.find((value) => !/^\d+\s+\S+$/.test(value));
    if (bad) errors.values = `${bad}: use the format 'priority mail-server', such as 10 mail.example.com.`;
  } else if (draft.type === "SRV") {
    const bad = values.find((value) => !/^\d+\s+\d+\s+\d+\s+\S+$/.test(value));
    if (bad) errors.values = `${bad}: use the format 'priority weight port target'.`;
  } else if (draft.type === "CAA") {
    const bad = values.find((value) => !/^\d+\s+\S+\s+".*"$/.test(value));
    if (bad) errors.values = `${bad}: use the format 'flags tag "value"', such as 0 issue "ca.example.net".`;
  }
  return errors;
}
