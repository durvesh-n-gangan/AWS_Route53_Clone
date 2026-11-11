import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { useFlash } from "@/components/common/FlashProvider";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { useBreadcrumbLabel } from "@/components/layout/ShellContext";
import { formatAccountId } from "@/components/layout/TopNav";

const navigation = vi.hoisted(() => ({
  pathname: "/route53/v2/home",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

function renderShell(children: ReactNode = <p>page body</p>) {
  const result = render(
    <Providers>
      <ConsoleShell>{children}</ConsoleShell>
    </Providers>,
  );
  return { ...result, wrapper: createWrapper(result.container) };
}

/** Renders nothing; exposes addFlash so a test can push messages. */
function captureAddFlash() {
  const handle: { addFlash: ReturnType<typeof useFlash>["addFlash"] } = { addFlash: () => "" };
  function Capture() {
    handle.addFlash = useFlash().addFlash;
    return null;
  }
  return { handle, Capture };
}

beforeEach(() => {
  navigation.pathname = "/route53/v2/home";
  navigation.push.mockReset();
});

describe("ConsoleShell", () => {
  it("renders the page content inside the console frame", () => {
    renderShell();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("shows the Route 53 side navigation with the current page active", () => {
    navigation.pathname = "/route53/v2/healthchecks";
    const { wrapper } = renderShell();

    const sideNav = wrapper.findSideNavigation();
    expect(sideNav).not.toBeNull();
    expect(sideNav!.findHeaderLink()!.getElement()).toHaveTextContent("Route 53");
    expect(sideNav!.findActiveLink()!.getElement()).toHaveTextContent("Health checks");
  });

  it("navigates client-side when a side-nav link is followed", () => {
    const { wrapper } = renderShell();

    wrapper.findSideNavigation()!.findLinkByHref("/route53/v2/profiles")!.click();

    expect(navigation.push).toHaveBeenCalledWith("/route53/v2/profiles");
  });

  it("builds breadcrumbs from the path and page-provided labels", () => {
    navigation.pathname = "/route53/v2/hostedzones/Z9";
    function ZonePage() {
      useBreadcrumbLabel("Z9", "example.com");
      return null;
    }
    const { wrapper } = renderShell(<ZonePage />);

    const crumbs = wrapper.findBreadcrumbGroup()!.findBreadcrumbLinks();
    expect(crumbs.map((crumb) => crumb.getElement().textContent)).toEqual([
      "Route 53",
      "Hosted zones",
      "example.com",
    ]);
  });

  it("shows flash messages added through context and dismisses them", () => {
    const { handle, Capture } = captureAddFlash();
    const { wrapper } = renderShell(<Capture />);

    act(() => {
      handle.addFlash({ type: "success", content: "Hosted zone created." });
    });
    const flashbar = wrapper.findFlashbar()!;
    expect(flashbar.findItems()).toHaveLength(1);
    expect(flashbar.findItems()[0].findContent()!.getElement()).toHaveTextContent(
      "Hosted zone created.",
    );

    act(() => {
      flashbar.findItems()[0].findDismissButton()!.click();
    });
    expect(wrapper.findFlashbar()!.findItems()).toHaveLength(0);
  });

  it("replaces a flash message that reuses the same id", () => {
    const { handle, Capture } = captureAddFlash();
    const { wrapper } = renderShell(<Capture />);

    act(() => {
      handle.addFlash({ id: "save", type: "in-progress", content: "Saving" });
      handle.addFlash({ id: "save", type: "success", content: "Saved" });
    });

    const items = wrapper.findFlashbar()!.findItems();
    expect(items).toHaveLength(1);
    expect(items[0].findContent()!.getElement()).toHaveTextContent("Saved");
  });

  it("shows the top navigation linking home, with Services and the Global region", () => {
    const { wrapper } = renderShell();
    const topNav = wrapper.findTopNavigation()!;

    expect(topNav.findIdentityLink()!.getElement()).toHaveAttribute("href", "/route53/v2/home");
    // jsdom has no layout width, so the utilities collapse into the "More" overflow menu.
    act(() => {
      topNav.findOverflowMenuButton()!.click();
    });
    const overflow = topNav.findOverflowMenu()!.getElement();
    expect(overflow).toHaveTextContent("Global");
    expect(overflow).toHaveTextContent("Services");
  });
});

describe("formatAccountId", () => {
  it("groups a 12-digit account number like the console", () => {
    expect(formatAccountId("123456789012")).toBe("1234-5678-9012");
  });
});
