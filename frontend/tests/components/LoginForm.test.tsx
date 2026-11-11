import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { LoginForm } from "@/components/auth/LoginForm";

import { DEMO_USER, errorResponse, jsonResponse, mockApi } from "../utils/mockApi";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), redirect: null as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.redirect ? { redirect: navigation.redirect } : {}),
}));

function renderForm() {
  const { container } = render(
    <Providers>
      <LoginForm />
    </Providers>,
  );
  const wrapper = createWrapper(container);
  const fields = wrapper.findAllFormFields();
  return {
    wrapper,
    username: fields[1].findControl()!.findInput()!,
    password: fields[2].findControl()!.findInput()!,
    submit: () => act(() => wrapper.findButton('[type="submit"]')!.click()),
  };
}

beforeEach(() => {
  navigation.replace.mockReset();
  navigation.redirect = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("shows the mocked account ID read-only", () => {
    const { wrapper } = renderForm();
    const accountInput = wrapper.findAllFormFields()[0].findControl()!.findInput()!;

    expect(accountInput.getInputValue()).toBe("123456789012");
    expect(accountInput.findNativeInput().getElement()).toHaveAttribute("readonly");
  });

  it("asks for both fields before calling the API", () => {
    const fetchMock = mockApi({});
    const { wrapper, submit } = renderForm();

    submit();

    const errors = wrapper.findAllFormFields().map((f) => f.findError()?.getElement().textContent);
    expect(errors).toEqual([undefined, "Enter your IAM user name.", "Enter your password."]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and goes to the requested page", async () => {
    navigation.redirect = "/route53/v2/profiles";
    const fetchMock = mockApi({ "POST /api/v1/auth/login": () => jsonResponse(DEMO_USER) });
    const { username, password, submit } = renderForm();

    username.setInputValue(" admin ");
    password.setInputValue("admin123");
    submit();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/route53/v2/profiles"));
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      username: "admin",
      password: "admin123",
    });
  });

  it("goes to hosted zones when there is no redirect", async () => {
    mockApi({ "POST /api/v1/auth/login": () => jsonResponse(DEMO_USER) });
    const { username, password, submit } = renderForm();

    username.setInputValue("admin");
    password.setInputValue("admin123");
    submit();

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/route53/v2/hostedzones"),
    );
  });

  it("shows the backend error and clears the password on bad credentials", async () => {
    mockApi({
      "POST /api/v1/auth/login": () =>
        errorResponse(401, "Unauthenticated", "Your authentication information is incorrect."),
    });
    const { wrapper, username, password, submit } = renderForm();

    username.setInputValue("admin");
    password.setInputValue("nope");
    submit();

    await waitFor(() =>
      expect(wrapper.findAlert()!.findContent().getElement()).toHaveTextContent(
        "Your authentication information is incorrect.",
      ),
    );
    expect(password.getInputValue()).toBe("");
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
