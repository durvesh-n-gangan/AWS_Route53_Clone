import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { ZonesTable } from "@/components/zones/ZonesTable";

import { page, zoneSummary } from "../utils/fixtures";
import { jsonResponse, mockApi } from "../utils/mockApi";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/route53/v2/hostedzones",
}));

const ZONES = [
  zoneSummary({ id: "ZAAA", name: "alpha.example.com.", record_count: 2 }),
  zoneSummary({ id: "ZBBB", name: "beta.example.org.", type: "private", comment: "", record_count: 5 }),
];

function renderTable() {
  const { container } = render(
    <Providers>
      <ZonesTable />
    </Providers>,
  );
  return createWrapper(container).findTable()!;
}

const listCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/v1/hostedzones");

beforeEach(() => router.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("ZonesTable", () => {
  it("shows Route 53's columns and one row per zone", async () => {
    mockApi({ "GET /api/v1/hostedzones": () => jsonResponse(page(ZONES)) });
    const table = renderTable();

    await waitFor(() => expect(table.findRows()).toHaveLength(2));
    // The first header is the selection column.
    const headers = table.findColumnHeaders().slice(1).map((h) => h.getElement().textContent);
    expect(headers).toEqual([
      "Hosted zone name",
      "Type",
      "Created by",
      "Record count",
      "Description",
      "Hosted zone ID",
    ]);
    expect(table.findBodyCell(1, 2)!.getElement()).toHaveTextContent("alpha.example.com");
    expect(table.findBodyCell(2, 3)!.getElement()).toHaveTextContent("Private");
    expect(table.findBodyCell(2, 6)!.getElement()).toHaveTextContent("-");
    expect(table.findHeaderSlot()!.getElement()).toHaveTextContent("Hosted zones (2)");
  });

  it("enables View details, Edit and Delete only when a zone is selected", async () => {
    mockApi({ "GET /api/v1/hostedzones": () => jsonResponse(page(ZONES)) });
    const table = renderTable();
    await waitFor(() => expect(table.findRows()).toHaveLength(2));

    const button = (label: string) =>
      table
        .findHeaderSlot()!
        .findAllButtons()
        .find((b) => b.getElement().textContent === label)!;

    for (const label of ["View details", "Edit", "Delete"]) {
      expect(button(label).isDisabled()).toBe(true);
    }
    act(() => table.findRowSelectionArea(2)!.click());
    for (const label of ["View details", "Edit", "Delete"]) {
      expect(button(label).isDisabled()).toBe(false);
    }

    act(() => button("Edit").click());
    expect(router.push).toHaveBeenCalledWith("/route53/v2/hostedzones/ZBBB/edit");

    // With two zones selected only Delete (bulk) stays available.
    act(() => table.findRowSelectionArea(1)!.click());
    expect(button("View details").isDisabled()).toBe(true);
    expect(button("Edit").isDisabled()).toBe(true);
    expect(button("Delete").isDisabled()).toBe(false);

    act(() => button("Delete").click());
    const modal = createWrapper(document.body).findModal()!;
    expect(modal.findHeader().getElement()).toHaveTextContent("Delete 2 hosted zones?");
  });

  it("sends the filter text to the API as a search parameter", async () => {
    const fetchMock = mockApi({
      "GET /api/v1/hostedzones": (_init, url) =>
        jsonResponse(page(url.includes("search=beta") ? [ZONES[1]] : ZONES)),
    });
    const table = renderTable();
    await waitFor(() => expect(table.findRows()).toHaveLength(2));

    act(() => table.findTextFilter()!.findInput().setInputValue("beta"));

    await waitFor(() => expect(table.findRows()).toHaveLength(1));
    expect(listCalls(fetchMock).at(-1)!.searchParams.get("search")).toBe("beta");
    expect(listCalls(fetchMock).at(-1)!.searchParams.get("page")).toBe("1");
  });

  it("asks the API for the next page and sorts on the server", async () => {
    const fetchMock = mockApi({
      "GET /api/v1/hostedzones": () => jsonResponse(page(ZONES, 25)),
    });
    const table = renderTable();
    await waitFor(() => expect(table.findPagination()!.findPageNumbers()).toHaveLength(3));

    act(() => table.findPagination()!.findNextPageButton().click());
    await waitFor(() => expect(listCalls(fetchMock).at(-1)!.searchParams.get("page")).toBe("2"));

    act(() => table.findColumnSortingArea(5)!.click()); // Record count (after the selection column)
    await waitFor(() =>
      expect(listCalls(fetchMock).at(-1)!.searchParams.get("sort")).toBe("record_count"),
    );
    expect(listCalls(fetchMock).at(-1)!.searchParams.get("page")).toBe("1");
  });

  it("shows the empty state with a Create hosted zone button", async () => {
    mockApi({ "GET /api/v1/hostedzones": () => jsonResponse(page([])) });
    const table = renderTable();

    await waitFor(() =>
      expect(table.findEmptySlot()!.getElement()).toHaveTextContent("No hosted zones"),
    );
    act(() => table.findEmptySlot()!.findButton()!.click());
    expect(router.push).toHaveBeenCalledWith("/route53/v2/hostedzones/create");
  });
});
