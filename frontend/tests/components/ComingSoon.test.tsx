import createWrapper from "@cloudscape-design/components/test-utils/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { PLACEHOLDER_PAGES, ROUTES } from "@/lib/navigation";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/route53/v2/home",
  useRouter: () => ({ push }),
}));

describe("ComingSoon", () => {
  it.each(["home", "trafficpolicies", "healthchecks", "resolver", "profiles"])(
    "renders the %s placeholder with its title and a Coming Soon message",
    (key) => {
      const page = PLACEHOLDER_PAGES[key];
      render(
        <Providers>
          <ComingSoon title={page.title} description={page.description} />
        </Providers>,
      );

      expect(screen.getByRole("heading", { level: 1, name: page.title })).toBeInTheDocument();
      expect(screen.getByText("Coming Soon")).toBeInTheDocument();
      expect(screen.getByText(page.description)).toBeInTheDocument();
    },
  );

  it("links back to hosted zones with client-side navigation", () => {
    const { container } = render(
      <Providers>
        <ComingSoon title="Dashboard" description="Overview" />
      </Providers>,
    );

    createWrapper(container).findButton()!.click();
    expect(push).toHaveBeenCalledWith(ROUTES.hostedZones);
  });

  it("opens topic help in the help panel when Info is followed", () => {
    const { container } = render(
      <Providers>
        <ConsoleShell>
          <ComingSoon title="Health checks" description="Monitor endpoints." />
        </ConsoleShell>
      </Providers>,
    );
    const wrapper = createWrapper(container);

    wrapper.findLink('[aria-label="Information about Health checks."]')!.click();

    const helpPanel = wrapper.findAppLayout()!.findTools()!.findHelpPanel()!;
    expect(helpPanel.findHeader()!.getElement()).toHaveTextContent("Health checks");
  });
});
