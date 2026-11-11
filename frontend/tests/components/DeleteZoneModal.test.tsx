import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { DeleteZoneModal } from "@/components/zones/DeleteZoneModal";

import { eventually } from "../utils/eventually";
import { jsonResponse, mockApi } from "../utils/mockApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ZONE = { id: "ZDEL", name: "example.com." };
const OTHER = { id: "ZTWO", name: "example.org." };
const BULK = "POST /api/v1/hostedzones/bulk-delete";

function renderModal(zones = [ZONE]) {
  const onDismiss = vi.fn();
  const onDeleted = vi.fn();
  render(
    <Providers>
      <DeleteZoneModal zones={zones} onDismiss={onDismiss} onDeleted={onDeleted} />
    </Providers>,
  );
  // Cloudscape renders modals in a portal on document.body.
  const modal = createWrapper(document.body).findModal()!;
  const deleteButton = () =>
    modal.findFooter()!.findAllButtons().find((b) => b.getElement().textContent === "Delete")!;
  const confirmAndDelete = () => {
    act(() => modal.findContent().findInput()!.setInputValue("delete"));
    act(() => deleteButton().click());
  };
  return { modal, deleteButton, confirmAndDelete, onDismiss, onDeleted };
}

afterEach(() => vi.unstubAllGlobals());

describe("DeleteZoneModal", () => {
  it("names the zone and keeps Delete disabled until 'delete' is typed", () => {
    mockApi({});
    const { modal, deleteButton } = renderModal();

    expect(modal.findHeader().getElement()).toHaveTextContent("Delete example.com?");
    expect(deleteButton().isDisabled()).toBe(true);

    act(() => modal.findContent().findInput()!.setInputValue("Delete"));
    expect(deleteButton().isDisabled()).toBe(true);

    act(() => modal.findContent().findInput()!.setInputValue("delete"));
    expect(deleteButton().isDisabled()).toBe(false);
  });

  it("deletes through the bulk endpoint and closes", async () => {
    const fetchMock = mockApi({ [BULK]: () => jsonResponse({ deleted: ["ZDEL"], failed: [] }) });
    const { confirmAndDelete, onDismiss, onDeleted } = renderModal();

    confirmAndDelete();

    await eventually(() => expect(onDeleted).toHaveBeenCalledWith(["ZDEL"]));
    expect(onDismiss).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ ids: ["ZDEL"] });
  });

  it("keeps the dialog open with Route 53's message when nothing could be deleted", async () => {
    mockApi({
      [BULK]: () =>
        jsonResponse({
          deleted: [],
          failed: [
            {
              id: "ZDEL",
              code: "HostedZoneNotEmpty",
              message:
                "The specified hosted zone contains non-required resource record sets and so cannot be deleted.",
            },
          ],
        }),
    });
    const { modal, confirmAndDelete, onDismiss } = renderModal();

    confirmAndDelete();

    await eventually(() =>
      expect(modal.findContent().getElement()).toHaveTextContent("non-required resource record sets"),
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("lists every selected zone and reports partial failures", async () => {
    mockApi({
      [BULK]: () =>
        jsonResponse({
          deleted: ["ZTWO"],
          failed: [{ id: "ZDEL", code: "HostedZoneNotEmpty", message: "Zone is not empty." }],
        }),
    });
    const { modal, confirmAndDelete, onDeleted } = renderModal([ZONE, OTHER]);

    expect(modal.findHeader().getElement()).toHaveTextContent("Delete 2 hosted zones?");
    expect(modal.findContent().getElement()).toHaveTextContent("example.com");
    expect(modal.findContent().getElement()).toHaveTextContent("example.org");

    confirmAndDelete();

    await eventually(() => expect(onDeleted).toHaveBeenCalledWith(["ZTWO"]));
  });
});
