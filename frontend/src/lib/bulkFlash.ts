import type { FlashInput } from "@/components/common/FlashProvider";
import type { BulkDeleteResult } from "@/types/api";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Turns a bulk-delete result into Flashbar messages: success for everything deleted, and a
 * warning (partial) or error (nothing deleted) listing what failed and why.
 */
export function bulkDeleteFlashes(
  result: BulkDeleteResult,
  noun: string,
  labelFor: (id: string) => string,
): FlashInput[] {
  const messages: FlashInput[] = [];
  if (result.deleted.length > 0) {
    messages.push({
      type: "success",
      content: `Successfully deleted ${plural(result.deleted.length, noun)}.`,
    });
  }
  if (result.failed.length > 0) {
    messages.push({
      type: result.deleted.length > 0 ? "warning" : "error",
      header: `${plural(result.failed.length, noun)} couldn't be deleted`,
      content: result.failed.map((failure) => `${labelFor(failure.id)}: ${failure.message}`).join(" "),
    });
  }
  return messages;
}
