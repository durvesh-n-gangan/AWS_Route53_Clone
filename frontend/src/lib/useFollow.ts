"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface FollowDetail {
  href?: string;
  external?: boolean;
}

/**
 * Cloudscape links fire `onFollow` events. For internal links we cancel the full page load
 * and navigate client-side with the Next.js router instead.
 */
export function useFollow() {
  const router = useRouter();
  return useCallback(
    (event: CustomEvent<FollowDetail>) => {
      const { href, external } = event.detail;
      if (!href || external || href.startsWith("http")) return;
      event.preventDefault();
      router.push(href);
    },
    [router],
  );
}
