import { ApiError } from "@/lib/api/client";

/** Maps a 422 response's `details.fields` to { "name": "message", "vpcs.0.vpc_id": ... }. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const fields = error.details.fields;
  if (!Array.isArray(fields)) return {};
  const result: Record<string, string> = {};
  for (const item of fields) {
    if (item && typeof item === "object" && "field" in item && "message" in item) {
      const field = String((item as { field: unknown }).field);
      result[field] ??= String((item as { message: unknown }).message);
    }
  }
  return result;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  return error instanceof ApiError ? error.message : fallback;
}
