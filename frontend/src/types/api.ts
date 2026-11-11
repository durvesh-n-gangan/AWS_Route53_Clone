/** Shapes shared with the FastAPI backend. */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export interface CurrentUser {
  username: string;
  account_id: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type ZoneType = "public" | "private";

export type ZoneSort =
  | "name"
  | "-name"
  | "created_at"
  | "-created_at"
  | "record_count"
  | "-record_count";

export interface Tag {
  key: string;
  value: string;
}

export interface VpcAssociation {
  vpc_id: string;
  region: string;
}

export interface HostedZoneSummary {
  id: string;
  /** Fully qualified, with a trailing dot (example.com.). */
  name: string;
  type: ZoneType;
  comment: string;
  record_count: number;
  created_by: string;
  caller_reference: string;
  created_at: string;
  updated_at: string;
}

export interface HostedZone extends HostedZoneSummary {
  name_servers: string[];
  tags: Tag[];
  vpcs: VpcAssociation[];
}

export interface ZoneListParams {
  search?: string;
  type?: ZoneType;
  sort?: ZoneSort;
  page?: number;
  page_size?: number;
}

export interface HostedZoneCreateInput {
  name: string;
  comment: string;
  type: ZoneType;
  vpcs: VpcAssociation[];
  tags: Tag[];
}

export interface HostedZoneUpdateInput {
  comment?: string;
  tags?: Tag[];
}

export type RecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "PTR" | "SRV" | "CAA" | "SOA";

export interface RecordSet {
  id: string;
  hosted_zone_id: string;
  /** Fully qualified, with a trailing dot. */
  name: string;
  type: RecordType;
  ttl: number;
  values: string[];
  routing_policy: string;
  set_identifier: string | null;
  alias_target: Record<string, unknown> | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordInput {
  name: string;
  type: RecordType;
  ttl: number;
  values: string[];
  routing_policy?: "simple";
}

export interface RecordListParams {
  search?: string;
  type?: RecordType;
  routing_policy?: "simple";
  page?: number;
  page_size?: number;
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: { id: string; code: string; message: string }[];
}

export interface ImportRow {
  name: string;
  type: string;
  ttl: number;
  values: string[];
  lines: number[];
  status: "ready" | "skipped" | "error";
  message: string;
}

export interface ImportResult {
  mode: "preview" | "commit";
  rows: ImportRow[];
  ready: number;
  skipped: number;
  errors: number;
  created: number;
}
