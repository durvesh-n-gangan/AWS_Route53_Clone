"use client";

import Link from "@cloudscape-design/components/link";
import type { ReactNode } from "react";

import { useShell } from "@/components/layout/ShellContext";

interface InfoLinkProps {
  /** Help panel content shown when the link is followed. */
  help: ReactNode;
  /** What the link explains, for screen readers ("Information about hosted zones"). */
  topic: string;
}

export function InfoLink({ help, topic }: InfoLinkProps) {
  const { openHelp } = useShell();
  return (
    <Link variant="info" ariaLabel={`Information about ${topic}.`} onFollow={() => openHelp(help)}>
      Info
    </Link>
  );
}
