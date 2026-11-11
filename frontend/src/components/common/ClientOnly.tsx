"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => undefined;

/**
 * Renders children only in the browser. Used for Cloudscape tables: they measure the page
 * on first render (sticky header, scrollbar offset), so server HTML can never match, and
 * their data is fetched client-side anyway.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? children : fallback;
}
