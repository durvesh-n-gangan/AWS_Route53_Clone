import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { RecordsTable } from "@/components/records/RecordsTable";

import { eventually } from "../utils/eventually";
import { page, recordSet, zoneDetail } from "../utils/fixtures";
import { DEMO_USER, jsonResponse, mockApi } from "../utils/mockApi";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/route53/v2/hostedzones/ZREC",
}));

const ZONE = zoneDetail({ id: "ZREC", name: "example.com." });
const RECORDS = [
  recordSet({ id: "RNS", name: "example.com.", type: "NS", ttl: 172800, values: ["ns-1.awsdns-01.com."], is_default: true }),
  recordSet({ id: "RSOA", name: "example.com.", type: "SOA", ttl: 900, values: ["ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"], is_default: true }),
  recordSet({ id: "RWWW", name: "www.example.com.", type: "A", values: ["192.0.2.10", "192.0.2.11"] }),
];

function renderTable() {
  const { container } = render(
    <Providers>
      <ConsoleShell>
        <RecordsTable zone={ZONE} />
      </ConsoleShell>
    </Providers>,
  );
  const wrapper = createWrapper(container);
  return { wrapper, table: () => wrapper.findTable()! };
}

function api(extra = {}) {
  return mockApi({
    "GET /api/v1/auth/me": () => jsonResponse(DEMO_USER),
    "GET /api/v1/hostedzones/ZREC/records": (_init, url) =>
      jsonResponse(page(url.includes("type=A") ? [RECORDS[2]] : RECORDS)),
    ...extra,
  });
}

beforeEach(() => router.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("RecordsTable", () => {
  it("shows the record columns with Simple routing and every value", async () => {
    api();
    const { table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    const headers = table().findColumnHeaders().slice(1).map((h) => h.getElement().textContent);
    expect(headers).toEqual([
      "Record name",
      "Type",
      "Routing policy",
      "Differentiator",
      "Alias",
      "Value/Route traffic to",
      "TTL (seconds)",
    ]);
    expect(table().findBodyCell(3, 2)!.getElement()).toHaveTextContent("www.example.com");
    expect(table().findBodyCell(3, 4)!.getElement()).toHaveTextContent("Simple");
    expect(table().findBodyCell(3, 7)!.getElement()).toHaveTextContent("192.0.2.10192.0.2.11");
  });

  it("filters by record type through the API", async () => {
    const fetchMock = api();
    const { table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    const select = table().findFilterSlot()!.findAllSelects()[0];
    act(() => select.openDropdown());
    act(() => select.selectOptionByValue("A"));

    await eventually(() => expect(table().findRows()).toHaveLength(1));
    const lastUrl = String(fetchMock.mock.calls.at(-1)![0]);
    expect(new URL(lastUrl, "http://x").searchParams.get("type")).toBe("A");
  });

  it("shows record details in the split panel and switches to the edit form", async () => {
    api();
    const { wrapper, table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    act(() => table().findRowSelectionArea(3)!.click());

    await eventually(() =>
      expect(wrapper.findSplitPanel()!.findHeader().getElement()).toHaveTextContent(
        "www.example.com (A)",
      ),
    );
    const panel = createWrapper(wrapper.findSplitPanel()!.getElement());
    expect(panel.getElement()).toHaveTextContent("192.0.2.10");
    expect(panel.findAllFormFields()).toHaveLength(0);

    act(() => panel.findAllButtons().find((b) => b.getElement().textContent === "Edit record")!.click());

    expect(panel.findAllFormFields().length).toBeGreaterThan(0);
  });

  it("locks name and type when a default record is edited", async () => {
    api();
    const { wrapper, table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    act(() => table().findRowSelectionArea(1)!.click());

    await eventually(() => expect(wrapper.findSplitPanel()).not.toBeNull());
    const panel = createWrapper(wrapper.findSplitPanel()!.getElement());
    act(() => panel.findAllButtons().find((b) => b.getElement().textContent === "Edit record")!.click());
    expect(panel.getElement()).toHaveTextContent("You can change its TTL and value only.");
    const [nameField, typeField] = panel.findAllFormFields();
    expect(nameField.findControl()!.findInput()!.isDisabled()).toBe(true);
    expect(typeField.findControl()!.findSelect()!.isDisabled()).toBe(true);
  });

  it("blocks deleting the default records", async () => {
    api();
    const { table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    act(() => table().findRowSelectionArea(1)!.click());
    act(() => table().findRowSelectionArea(3)!.click());
    act(() =>
      table()
        .findHeaderSlot()!
        .findAllButtons()
        .find((b) => b.getElement().textContent === "Delete record")!
        .click(),
    );

    const modal = createWrapper(document.body).findModal()!;
    expect(modal.getElement()).toHaveTextContent("Default records can't be deleted");
    const del = modal.findFooter()!.findAllButtons().find((b) => b.getElement().textContent === "Delete")!;
    expect(del.isDisabled()).toBe(true);
  });

  it("deletes the selected records", async () => {
    const fetchMock = api({
      "POST /api/v1/hostedzones/ZREC/records/bulk-delete": () =>
        jsonResponse({ deleted: ["RWWW"], failed: [] }),
    });
    const { table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    act(() => table().findRowSelectionArea(3)!.click());
    act(() =>
      table()
        .findHeaderSlot()!
        .findAllButtons()
        .find((b) => b.getElement().textContent === "Delete record")!
        .click(),
    );
    const modal = createWrapper(document.body).findModal()!;
    act(() => modal.findFooter()!.findAllButtons().find((b) => b.getElement().textContent === "Delete")!.click());

    await eventually(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/hostedzones/ZREC/records/bulk-delete",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ ids: ["RWWW"] }) }),
      ),
    );
  });

  it("opens the Quick create page", async () => {
    api();
    const { table } = renderTable();
    await eventually(() => expect(table().findRows()).toHaveLength(3));

    act(() =>
      table()
        .findHeaderSlot()!
        .findAllButtons()
        .find((b) => b.getElement().textContent === "Create record")!
        .click(),
    );
    expect(router.push).toHaveBeenCalledWith("/route53/v2/hostedzones/ZREC/records/create");
  });
});
