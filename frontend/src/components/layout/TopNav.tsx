"use client";

import Input from "@cloudscape-design/components/input";
import TopNavigation, {
  type TopNavigationProps,
} from "@cloudscape-design/components/top-navigation";
import { useState } from "react";

import { ROUTES } from "@/lib/navigation";
import { setThemeMode, useThemeMode } from "@/lib/theme";
import { useFollow } from "@/lib/useFollow";

/**
 * A plain text mark drawn for this project. The real AWS logo is a trademark and is not
 * used (PROJECT_PLAN.md section 9.2).
 */
const TEXT_MARK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="24" viewBox="0 0 42 24">' +
      '<text x="1" y="17" font-family="Helvetica, Arial, sans-serif" font-size="19" ' +
      'font-weight="700" fill="#ffffff">aws</text></svg>',
  );

export interface TopNavAccount {
  username: string;
  accountId: string;
}

interface TopNavProps {
  account?: TopNavAccount | null;
  onSignOut?: () => void;
  onShowShortcuts?: () => void;
}

/** Formats a 12-digit account ID the way the console does: 1234-5678-9012. */
export function formatAccountId(accountId: string): string {
  return accountId.replace(/^(\d{4})(\d{4})(\d{4})$/, "$1-$2-$3");
}

export function TopNav({ account, onSignOut, onShowShortcuts }: TopNavProps) {
  const [search, setSearch] = useState("");
  const onFollow = useFollow();
  const mode = useThemeMode();

  const accountLabel = account
    ? `${account.username} @ ${formatAccountId(account.accountId)}`
    : "Account";

  const utilities: TopNavigationProps.Utility[] = [
    {
      type: "menu-dropdown",
      text: "Services",
      iconName: "grid-view",
      ariaLabel: "Services",
      items: [
        { id: "route53", text: "Route 53", href: ROUTES.dashboard },
        { id: "others", text: "Other services are not part of this demo", disabled: true },
      ],
      onItemFollow: onFollow,
    },
    { type: "button", iconName: "command-prompt", ariaLabel: "CloudShell", title: "CloudShell" },
    { type: "button", iconName: "notification", ariaLabel: "Notifications", title: "Notifications" },
    {
      type: "button",
      iconName: "support",
      ariaLabel: "Keyboard shortcuts and help",
      title: "Help",
      onClick: onShowShortcuts,
    },
    {
      type: "menu-dropdown",
      iconName: "settings",
      ariaLabel: "Settings",
      title: "Settings",
      items: [
        {
          id: "visual-mode",
          text: "Visual mode",
          items: [
            { id: "theme-light", text: "Light", itemType: "checkbox", checked: mode === "light" },
            { id: "theme-dark", text: "Dark", itemType: "checkbox", checked: mode === "dark" },
          ],
        },
        { id: "shortcuts", text: "Keyboard shortcuts" },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id === "theme-light") setThemeMode("light");
        if (detail.id === "theme-dark") setThemeMode("dark");
        if (detail.id === "shortcuts") onShowShortcuts?.();
      },
    },
    {
      type: "menu-dropdown",
      text: "Global",
      ariaLabel: "Region: Global",
      items: [
        {
          id: "global-note",
          text: "Route 53 is a global service and does not need a region.",
          disabled: true,
        },
      ],
    },
    {
      type: "menu-dropdown",
      text: accountLabel,
      ariaLabel: `Account menu for ${accountLabel}`,
      items: [
        { id: "account", text: "Account", disabled: true },
        { id: "organization", text: "Organization", disabled: true },
        { id: "billing", text: "Billing and Cost Management", disabled: true },
        { id: "credentials", text: "Security credentials", disabled: true },
        { id: "signout", text: "Sign out", disabled: !onSignOut },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id === "signout") onSignOut?.();
      },
    },
  ];

  return (
    <TopNavigation
      identity={{
        href: ROUTES.dashboard,
        logo: { src: TEXT_MARK, alt: "Console home" },
        onFollow: (event) => onFollow(event as CustomEvent<{ href?: string }>),
      }}
      search={
        <Input
          type="search"
          value={search}
          placeholder="Search"
          ariaLabel="Search"
          onChange={({ detail }) => setSearch(detail.value)}
        />
      }
      utilities={utilities}
      i18nStrings={{
        overflowMenuTriggerText: "More",
        overflowMenuTitleText: "All",
        overflowMenuBackIconAriaLabel: "Back",
        overflowMenuDismissIconAriaLabel: "Close menu",
        searchIconAriaLabel: "Search",
        searchDismissIconAriaLabel: "Close search",
      }}
    />
  );
}
