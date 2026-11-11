import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api/client";
import { downloadZoneExport } from "@/lib/api/zoneFiles";

afterEach(() => vi.unstubAllGlobals());

describe("downloadZoneExport", () => {
  it("downloads the file under the server's file name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("$ORIGIN example.com.\n", {
          headers: { "Content-Disposition": 'attachment; filename="example.com.zone"' },
        }),
      ),
    );
    const createObjectURL = vi.fn(() => "blob:zone");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clicks: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });

    await downloadZoneExport("ZEXP", "bind");

    expect(fetch).toHaveBeenCalledWith("/api/v1/hostedzones/ZEXP/export?format=bind", { credentials: "include" });
    expect(clicks).toEqual(["example.com.zone"]);
    click.mockRestore();
  });

  it("throws when the export fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    await expect(downloadZoneExport("ZNOPE", "json")).rejects.toMatchObject({ status: 404 });
  });
});

describe("apiFetch with FormData", () => {
  it("sends multipart bodies without forcing a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("text", "www IN A 192.0.2.1");

    await apiFetch("/x", { method: "POST", body: form });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });
});
