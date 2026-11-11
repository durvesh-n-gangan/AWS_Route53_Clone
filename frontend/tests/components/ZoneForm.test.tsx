import createWrapper, { type ElementWrapper } from "@cloudscape-design/components/test-utils/dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { validateZoneForm, ZoneForm } from "@/components/zones/ZoneForm";

import { zoneDetail } from "../utils/fixtures";
import { eventually } from "../utils/eventually";
import { errorResponse, jsonResponse, mockApi } from "../utils/mockApi";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/route53/v2/hostedzones/create",
}));

function renderForm(props: Parameters<typeof ZoneForm>[0] = { mode: "create" }) {
  const { container } = render(
    <Providers>
      <ZoneForm {...props} />
    </Providers>,
  );
  const wrapper = createWrapper(container);
  const field = (label: string) =>
    wrapper
      .findAllFormFields()
      .find((f) => f.findLabel()?.getElement().textContent?.startsWith(label))!;
  return {
    wrapper,
    field,
    submit: () => act(() => wrapper.findButton('[type="submit"]')!.click()),
  };
}

const errorText = (element: ElementWrapper | null) => element?.getElement().textContent;

beforeEach(() => router.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("ZoneForm (create)", () => {
  it("requires a domain name and does not call the API", () => {
    const fetchMock = mockApi({});
    const { field, submit } = renderForm();

    submit();

    expect(errorText(field("Domain name").findError())).toBe("Enter a domain name.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a field error as soon as the field is edited", () => {
    mockApi({});
    const { field, submit } = renderForm();
    submit();

    act(() => field("Domain name").findControl()!.findInput()!.setInputValue("ex"));

    expect(field("Domain name").findError()).toBeNull();
  });

  it("reveals the VPC section only for a private hosted zone", () => {
    mockApi({});
    const { wrapper } = renderForm();
    expect(wrapper.getElement()).not.toHaveTextContent("VPCs to associate with the hosted zone");

    act(() => wrapper.findTiles()!.findItemByValue("private")!.findNativeInput().click());

    expect(wrapper.getElement()).toHaveTextContent("VPCs to associate with the hosted zone");
  });

  it("creates the zone, shows a success flash and opens the zone", async () => {
    const created = zoneDetail({ id: "ZNEW", name: "demo.example.net." });
    const fetchMock = mockApi({
      "POST /api/v1/hostedzones": () => jsonResponse(created, 201),
    });
    const { field, wrapper, submit } = renderForm();

    act(() => field("Domain name").findControl()!.findInput()!.setInputValue(" demo.example.net "));
    act(() => wrapper.findAttributeEditor()!.findAddButton().click());
    act(() =>
      wrapper.findAttributeEditor()!.findRow(1)!.findField(1)!.findControl()!.findInput()!
        .setInputValue("Owner"),
    );
    submit();

    await eventually(() => expect(router.push).toHaveBeenCalledWith("/route53/v2/hostedzones/ZNEW"));
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      name: "demo.example.net",
      comment: "",
      type: "public",
      vpcs: [],
      tags: [{ key: "Owner", value: "" }],
    });
  });

  it("puts a duplicate-zone error on the domain name field", async () => {
    mockApi({
      "POST /api/v1/hostedzones": () =>
        errorResponse(409, "HostedZoneAlreadyExists", "A public hosted zone named x already exists."),
    });
    const { field, submit } = renderForm();
    act(() => field("Domain name").findControl()!.findInput()!.setInputValue("example.com"));

    submit();

    await eventually(() =>
      expect(errorText(field("Domain name").findError())).toBe(
        "A public hosted zone named x already exists.",
      ),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("ZoneForm (edit)", () => {
  it("locks the name and type, and saves description and tags", async () => {
    const zone = zoneDetail({ tags: [{ key: "env", value: "dev" }] });
    const fetchMock = mockApi({
      [`PATCH /api/v1/hostedzones/${zone.id}`]: () =>
        jsonResponse({ ...zone, comment: "Updated" }),
    });
    const { field, wrapper, submit } = renderForm({ mode: "edit", zone });

    expect(field("Domain name").findControl()!.findInput()!.isDisabled()).toBe(true);
    act(() => field("Description").findControl()!.findTextarea()!.setTextareaValue("Updated"));
    submit();

    await eventually(() => expect(router.push).toHaveBeenCalledWith(`/route53/v2/hostedzones/${zone.id}`));
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      comment: "Updated",
      tags: [{ key: "env", value: "dev" }],
    });
    expect(wrapper.findButton('[type="submit"]')!.getElement()).toHaveTextContent("Save changes");
  });
});

describe("validateZoneForm", () => {
  const base = { name: "example.com", comment: "", type: "public" as const, vpcs: [], tags: [] };

  it.each(["example.com", "a.b.example.co.uk", "_dmarc.example.org.", "xn--bcher-kva.example"])(
    "accepts %s",
    (name) => {
      expect(validateZoneForm({ ...base, name }, "create")).toEqual({});
    },
  );

  it.each(["localhost", "-bad-.com", "a..b.com", "bad domain.com", "example.123"])(
    "rejects %s",
    (name) => {
      expect(validateZoneForm({ ...base, name }, "create").name).toBeDefined();
    },
  );

  it("needs a valid VPC for a private zone", () => {
    expect(validateZoneForm({ ...base, type: "private" }, "create").vpcs).toBeDefined();
    const errors = validateZoneForm(
      { ...base, type: "private", vpcs: [{ region: "us-east-1", vpc_id: "vpc-nope" }] },
      "create",
    );
    expect(errors["vpcs.0.vpc_id"]).toBeDefined();
  });

  it("flags duplicate and empty tag keys", () => {
    const errors = validateZoneForm(
      { ...base, tags: [{ key: "a", value: "" }, { key: "a", value: "" }, { key: " ", value: "" }] },
      "create",
    );
    expect(errors["tags.1.key"]).toBe("Keys must be unique.");
    expect(errors["tags.2.key"]).toBe("Enter a key.");
  });
});
