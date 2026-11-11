import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { ImportZoneFileModal } from "@/components/records/ImportZoneFileModal";
import type { ImportResult } from "@/types/api";

import { eventually } from "../utils/eventually";
import { jsonResponse, mockApi } from "../utils/mockApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREVIEW: ImportResult = {
  mode: "preview",
  ready: 1,
  skipped: 1,
  errors: 1,
  created: 0,
  rows: [
    { name: "www.example.com.", type: "A", ttl: 300, values: ["192.0.2.1"], lines: [3], status: "ready", message: "" },
    { name: "example.com.", type: "SOA", ttl: 900, values: ["x"], lines: [1], status: "skipped", message: "Route 53 manages it." },
    { name: "bad.example.com.", type: "A", ttl: 300, values: ["999.1.1.1"], lines: [4], status: "error", message: "Line 4: not valid" },
  ],
};

function renderModal() {
  const onDismiss = vi.fn();
  render(
    <Providers>
      <ImportZoneFileModal zoneId="ZIMP" zoneName="example.com." visible onDismiss={onDismiss} />
    </Providers>,
  );
  const modal = createWrapper(document.body).findModal()!;
  const footerButton = (label: string) =>
    modal.findFooter()!.findAllButtons().find((b) => b.getElement().textContent?.startsWith(label))!;
  return { modal, footerButton, onDismiss };
}

afterEach(() => vi.unstubAllGlobals());

describe("ImportZoneFileModal", () => {
  it("needs text or a file before previewing", () => {
    mockApi({});
    const { footerButton } = renderModal();
    expect(footerButton("Preview").isDisabled()).toBe(true);
  });

  it("previews pasted text, then imports the ready rows", async () => {
    const fetchMock = mockApi({
      "POST /api/v1/hostedzones/ZIMP/import": (_init, url) =>
        jsonResponse(
          url.includes("mode=commit") ? { ...PREVIEW, mode: "commit", created: 1 } : PREVIEW,
        ),
    });
    const { modal, footerButton, onDismiss } = renderModal();

    act(() => modal.findContent().findTextarea()!.setTextareaValue("www IN A 192.0.2.1"));
    act(() => footerButton("Preview").click());

    await eventually(() => expect(modal.findContent().findTable()!.findRows()).toHaveLength(3));
    expect(modal.findContent().getElement()).toHaveTextContent("Line 4: not valid");
    const previewCall = fetchMock.mock.calls[0];
    expect(String(previewCall[0])).toContain("mode=preview");
    expect((previewCall[1]!.body as FormData).get("text")).toBe("www IN A 192.0.2.1");

    act(() => footerButton("Import 1 record").click());

    await eventually(() => expect(onDismiss).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls.find(([url]) => String(url).includes("mode=commit"))![0])).toContain(
      "/api/v1/hostedzones/ZIMP/import",
    );
  });

  it("shows the server error when the file can't be read", async () => {
    mockApi({
      "POST /api/v1/hostedzones/ZIMP/import": () =>
        jsonResponse({ error: { code: "InvalidInput", message: "The zone file is empty.", details: {} } }, 422),
    });
    const { modal, footerButton } = renderModal();

    act(() => modal.findContent().findTextarea()!.setTextareaValue(" x"));
    act(() => footerButton("Preview").click());

    await eventually(() =>
      expect(modal.findContent().findAlert()!.getElement()).toHaveTextContent("The zone file is empty."),
    );
  });
});
