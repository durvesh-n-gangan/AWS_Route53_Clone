"use client";

import SideNavigation from "@cloudscape-design/components/side-navigation";
import { usePathname } from "next/navigation";

import { findActiveHref, ROUTES, SIDE_NAV_ITEMS } from "@/lib/navigation";
import { useFollow } from "@/lib/useFollow";

export function Route53SideNav() {
  const pathname = usePathname() ?? "";
  const onFollow = useFollow();

  return (
    <SideNavigation
      header={{ text: "Route 53", href: ROUTES.dashboard }}
      activeHref={findActiveHref(pathname)}
      items={SIDE_NAV_ITEMS}
      onFollow={onFollow}
    />
  );
}
