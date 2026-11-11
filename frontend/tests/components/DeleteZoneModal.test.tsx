import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { DeleteZoneModal } from "@/components/zones/DeleteZoneModal";

import { errorResponse, mockApi } from "../utils/mockApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ZONE = { id: "ZDEL", name: "example.com." };

function renderModal() {
  const onDismiss = vi.fn();
  const onDeleted = vi.fn();
  render(
    <Providers>
      <DeleteZoneModal zone={ZONE} onDismiss={onDismiss} onDeleted={onDeleted} />
    </Providers>,
  );
  // Cloudscape renders modals in a portal on document.body.
  const modal = createWrapper(document.body).findModal()!;
  const deleteButton = () =>
    modal.findFooter()!.findAllButtons().find((b) => b.getElement().textContent === "Delete")!;
  return { modal, deleteButton, onDismiss, onDeleted };
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

  it("deletes the zone and closes", async () => {
    const fetchMock = mockApi({
      "DELETE /api/v1/hostedzones/ZDEL": () => new Response(null, { status: 204 }),
    });
    const { modal, deleteButton, onDismiss, onDeleted } = renderModal();

    act(() => modal.findContent().findInput()!.setInputValue("delete"));
    act(() => deleteButton().click());

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(onDismiss).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/hostedzones/ZDEL",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows the Route 53 error inside the modal when the zone is not empty", async () => {
    mockApi({
      "DELETE /api/v1/hostedzones/ZDEL": () =>
        errorResponse(
          409,
          "HostedZoneNotEmpty",
          "The specified hosted zone contains non-required resource record sets and so cannot be deleted.",
        ),
    });
    const { modal, deleteButton, onDismiss } = renderModal();

    act(() => modal.findContent().findInput()!.setInputValue("delete"));
    act(() => deleteButton().click());

    await waitFor(() =>
      expect(modal.findContent().getElement()).toHaveTextContent("non-required resource record sets"),
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
