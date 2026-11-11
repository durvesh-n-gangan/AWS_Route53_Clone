"use client";

import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { DefaultHelp } from "@/components/layout/HelpPanelContent";
import { Route53SideNav } from "@/components/layout/Route53SideNav";
import { useShell } from "@/components/layout/ShellContext";
import { TopNav } from "@/components/layout/TopNav";
import { buildBreadcrumbs } from "@/lib/navigation";
import { useLogout, useMe } from "@/lib/queries/auth";
import { useFollow } from "@/lib/useFollow";

/** The console frame shared by every /route53/v2 page. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const onFollow = useFollow();
  const { items: flashItems } = useFlash();
  const { helpContent, toolsOpen, setToolsOpen, breadcrumbLabels } = useShell();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <>
      <div id="top-nav">
        <TopNav
          account={me ? { username: me.username, accountId: me.account_id } : null}
          onSignOut={() => logout.mutate()}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        navigation={<Route53SideNav />}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        breadcrumbs={
          <BreadcrumbGroup
            items={buildBreadcrumbs(pathname, breadcrumbLabels)}
            ariaLabel="Breadcrumbs"
            expandAriaLabel="Show path"
            onFollow={onFollow}
          />
        }
        notifications={
          <Flashbar
            items={flashItems}
            stackItems={flashItems.length > 2}
            i18nStrings={{
              ariaLabel: "Notifications",
              notificationBarText: "Notifications",
              notificationBarAriaLabel: "View all notifications",
              errorIconAriaLabel: "Error",
              successIconAriaLabel: "Success",
              warningIconAriaLabel: "Warning",
              infoIconAriaLabel: "Info",
              inProgressIconAriaLabel: "In progress",
            }}
          />
        }
        tools={helpContent ?? <DefaultHelp />}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        ariaLabels={{
          navigation: "Route 53 navigation",
          navigationClose: "Close navigation",
          navigationToggle: "Open navigation",
          notifications: "Notifications",
          tools: "Help panel",
          toolsClose: "Close help panel",
          toolsToggle: "Open help panel",
        }}
        content={children}
      />
    </>
  );
}
