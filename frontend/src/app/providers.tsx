"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { FlashProvider } from "@/components/common/FlashProvider";
import { ShellProvider } from "@/components/layout/ShellContext";
import { createQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; useState keeps it stable across renders.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <ShellProvider>{children}</ShellProvider>
      </FlashProvider>
    </QueryClientProvider>
  );
}
