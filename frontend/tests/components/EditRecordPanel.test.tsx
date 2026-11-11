import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { EditRecordPanel } from "@/components/records/EditRecordPanel";

import { eventually } from "../utils/eventually";
import { recordSet } from "../utils/fixtures";
import { errorResponse, jsonResponse, mockApi } from "../utils/mockApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

const RECORD = recordSet({ id: "RWWW", name: "www.example.com.", values: ["192.0.2.10"] });

function renderPanel(record = RECORD) {
  const onDone = vi.fn();
  const { container } = render(
    <Providers>
      <EditRecordPanel zoneId="ZREC" zoneName="example.com." record={record} onDone={onDone} />
    </Providers>,
  );
  const wrapper = createWrapper(container);
  const field = (label: string) =>
    wrapper.findAllFormFields().find((f) => f.findLabel()?.getElement().textContent?.startsWith(label))!;
  return { wrapper, field, onDone, save: () => act(() => wrapper.findButton('[type="submit"]')!.click()) };
}

afterEach(() => vi.unstubAllGlobals());

describe("EditRecordPanel", () => {
  it("prefills the form from the record", () => {
    mockApi({});
    const { field } = renderPanel();
    expect(field("Record name").findControl()!.findInput()!.getInputValue()).toBe("www");
    expect(field("Value").findControl()!.findTextarea()!.getTextareaValue()).toBe("192.0.2.10");
    expect(field("TTL").findControl()!.findInput()!.getInputValue()).toBe("300");
  });

  it("saves the changes with PUT and closes", async () => {
    const fetchMock = mockApi({
      "PUT /api/v1/hostedzones/ZREC/records/RWWW": () => jsonResponse({ ...RECORD, values: ["203.0.113.5"] }),
    });
    const { field, save, onDone } = renderPanel();

    act(() => field("Value").findControl()!.findTextarea()!.setTextareaValue("203.0.113.5"));
    save();

    await eventually(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      name: "www",
      type: "A",
      ttl: 300,
      values: ["203.0.113.5"],
      routing_policy: "simple",
    });
  });

  it("shows a backend validation error on its field", async () => {
    mockApi({
      "PUT /api/v1/hostedzones/ZREC/records/RWWW": () =>
        jsonResponse(
          { error: { code: "InvalidInput", message: "bad", details: { fields: [{ field: "values", message: "Not valid here." }] } } },
          422,
        ),
    });
    const { field, save, onDone } = renderPanel();

    act(() => field("Value").findControl()!.findTextarea()!.setTextareaValue("192.0.2.99"));
    save();

    await eventually(() =>
      expect(field("Value").findError()!.getElement()).toHaveTextContent("Not valid here."),
    );
    expect(onDone).not.toHaveBeenCalled();
    void errorResponse;
  });
});
