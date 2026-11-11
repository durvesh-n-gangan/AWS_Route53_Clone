import { describe, expect, it } from "vitest";

import { bulkDeleteFlashes } from "@/lib/bulkFlash";

const label = (id: string) => `zone-${id}`;

describe("bulkDeleteFlashes", () => {
  it("reports full success", () => {
    expect(bulkDeleteFlashes({ deleted: ["1", "2"], failed: [] }, "hosted zone", label)).toEqual([
      { type: "success", content: "Successfully deleted 2 hosted zones." },
    ]);
  });

  it("adds a warning for partial failures, naming each failed item", () => {
    const messages = bulkDeleteFlashes(
      { deleted: ["1"], failed: [{ id: "2", code: "X", message: "Not empty." }] },
      "record",
      label,
    );
    expect(messages.map((m) => m.type)).toEqual(["success", "warning"]);
    expect(messages[1]).toMatchObject({
      header: "1 record couldn't be deleted",
      content: "zone-2: Not empty.",
    });
  });

  it("uses an error when nothing was deleted", () => {
    const messages = bulkDeleteFlashes(
      { deleted: [], failed: [{ id: "1", code: "X", message: "No." }] },
      "record",
      label,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("error");
  });
});
