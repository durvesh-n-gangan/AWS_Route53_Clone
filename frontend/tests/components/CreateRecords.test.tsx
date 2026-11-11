import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { CreateRecords, rowErrorsFrom } from "@/components/records/CreateRecords";
import { ApiError } from "@/lib/api/client";

import { eventually } from "../utils/eventually";
import { zoneDetail } from "../utils/fixtures";
import { errorResponse, jsonResponse, mockApi } from "../utils/mockApi";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/" }));

const ZONE = zoneDetail({ id: "ZREC", name: "example.com." });

async function renderPage() {
  const { container } = render(
    <Providers>
      <CreateRecords zoneId="ZREC" />
    </Providers>,
  );
  const wrapper = createWrapper(container);
  await eventually(() => expect(wrapper.findForm()).not.toBeNull());
  const rowFields = (row: number, label: string) =>
    wrapper
      .findAllFormFields()
      .filter((f) => f.findLabel()?.getElement().textContent?.startsWith(label))[row]!;
  return {
    wrapper,
    rowFields,
    button: (text: string) =>
      wrapper.findAllButtons().find((b) => b.getElement().textContent?.trim() === text)!,
    submit: () => act(() => wrapper.findButton('[type="submit"]')!.click()),
  };
}

beforeEach(() => router.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("CreateRecords (Quick create)", () => {
  it("shows the zone name as the record-name suffix", async () => {
    mockApi({ "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE) });
    const { wrapper } = await renderPage();
    expect(wrapper.getElement()).toHaveTextContent(".example.com");
  });

  it("sets the TTL from the 1m / 1h / 1d buttons", async () => {
    mockApi({ "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE) });
    const { rowFields, button } = await renderPage();
    const ttl = () => rowFields(0, "TTL").findControl()!.findInput()!.getInputValue();

    act(() => button("1m").click());
    expect(ttl()).toBe("60");
    act(() => button("1h").click());
    expect(ttl()).toBe("3600");
    act(() => button("1d").click());
    expect(ttl()).toBe("86400");
  });

  it("adds and removes record rows", async () => {
    mockApi({ "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE) });
    const { wrapper, button } = await renderPage();
    const headers = () =>
      wrapper
        .findAllHeaders()
        .map((h) => h.findHeadingText().getElement().textContent)
        .filter((t) => t?.startsWith("Record "));

    act(() => button("Add another record").click());
    act(() => button("Add another record").click());
    expect(headers()).toEqual(["Record 1", "Record 2", "Record 3"]);

    act(() => wrapper.findAllButtons().filter((b) => b.getElement().textContent === "Remove")[1].click());
    expect(headers()).toEqual(["Record 1", "Record 2"]);
  });

  it("changes the value hint with the record type", async () => {
    mockApi({ "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE) });
    const { rowFields } = await renderPage();
    const hint = () => rowFields(0, "Value").findConstraint()!.getElement().textContent;
    expect(hint()).toContain("IPv4 address");

    const select = rowFields(0, "Record type").findControl()!.findSelect()!;
    act(() => select.openDropdown());
    act(() => select.selectOptionByValue("MX"));

    expect(hint()).toContain("[priority] [mail server host name]");
  });

  it("validates rows before calling the API", async () => {
    const fetchMock = mockApi({ "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE) });
    const { rowFields, submit } = await renderPage();

    submit();

    expect(rowFields(0, "Value").findError()!.getElement()).toHaveTextContent("Enter a value.");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the zone load
  });

  it("creates the records and returns to the zone", async () => {
    const fetchMock = mockApi({
      "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE),
      "POST /api/v1/hostedzones/ZREC/records": () => jsonResponse({ items: [{}, {}] }, 201),
    });
    const { rowFields, button, submit } = await renderPage();
    act(() => rowFields(0, "Record name").findControl()!.findInput()!.setInputValue("www"));
    act(() => rowFields(0, "Value").findControl()!.findTextarea()!.setTextareaValue("192.0.2.1"));
    act(() => button("Add another record").click());
    act(() => rowFields(1, "Value").findControl()!.findTextarea()!.setTextareaValue('"txt"'));
    const select = rowFields(1, "Record type").findControl()!.findSelect()!;
    act(() => select.openDropdown());
    act(() => select.selectOptionByValue("TXT"));

    submit();

    await eventually(() => expect(router.push).toHaveBeenCalledWith("/route53/v2/hostedzones/ZREC"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    const body = JSON.parse(post[1]!.body as string);
    expect(body.records).toEqual([
      { name: "www", type: "A", ttl: 300, values: ["192.0.2.1"], routing_policy: "simple" },
      { name: "", type: "TXT", ttl: 300, values: ['"txt"'], routing_policy: "simple" },
    ]);
  });

  it("shows backend errors on the row they belong to", async () => {
    mockApi({
      "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE),
      "POST /api/v1/hostedzones/ZREC/records": () =>
        jsonResponse(
          {
            error: {
              code: "InvalidChangeBatch",
              message: "1 of 2 records are not valid.",
              details: { errors: [null, { values: "70000 mail: the priority is too big." }] },
            },
          },
          422,
        ),
    });
    const { rowFields, button, submit } = await renderPage();
    act(() => rowFields(0, "Value").findControl()!.findTextarea()!.setTextareaValue("192.0.2.1"));
    act(() => button("Add another record").click());
    act(() => rowFields(1, "Value").findControl()!.findTextarea()!.setTextareaValue("192.0.2.2"));

    submit();

    await eventually(() =>
      expect(rowFields(1, "Value").findError()!.getElement()).toHaveTextContent("priority is too big"),
    );
    expect(rowFields(0, "Value").findError()).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("reports a 409 conflict on the record name", async () => {
    mockApi({
      "GET /api/v1/hostedzones/ZREC": () => jsonResponse(ZONE),
      "POST /api/v1/hostedzones/ZREC/records": () =>
        jsonResponse(
          {
            error: {
              code: "InvalidChangeBatch",
              message: "Tried to create resource record set but it already exists",
              details: { errors: [{ name: "Tried to create resource record set but it already exists" }] },
            },
          },
          409,
        ),
    });
    const { rowFields, submit } = await renderPage();
    act(() => rowFields(0, "Value").findControl()!.findTextarea()!.setTextareaValue("192.0.2.1"));

    submit();

    await eventually(() =>
      expect(rowFields(0, "Record name").findError()!.getElement()).toHaveTextContent("already exists"),
    );
  });
});

describe("rowErrorsFrom", () => {
  it("maps schema errors like records.1.ttl to the row", () => {
    const error = new ApiError(422, "InvalidInput", "bad", {
      fields: [{ field: "records.1.ttl", message: "too big" }],
    });
    expect(rowErrorsFrom(error, 2)).toEqual([{}, { ttl: "too big" }]);
  });

  it("returns null for errors without row details", () => {
    expect(rowErrorsFrom(new ApiError(500, "InternalError", "x"), 1)).toBeNull();
    expect(rowErrorsFrom(new Error("x"), 1)).toBeNull();
    void errorResponse;
  });
});
