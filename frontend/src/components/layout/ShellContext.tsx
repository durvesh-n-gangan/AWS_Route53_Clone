"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ShellContextValue {
  /** Content of the help ("tools") panel; null shows the default Route 53 help. */
  helpContent: ReactNode | null;
  toolsOpen: boolean;
  setToolsOpen: (open: boolean) => void;
  /** Opens the help panel with topic-specific content (used by "Info" links). */
  openHelp: (content: ReactNode) => void;
  breadcrumbLabels: Readonly<Record<string, string>>;
  setBreadcrumbLabel: (segment: string, label: string) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [helpContent, setHelpContent] = useState<ReactNode | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [breadcrumbLabels, setBreadcrumbLabels] = useState<Record<string, string>>({});

  const openHelp = useCallback((content: ReactNode) => {
    setHelpContent(content);
    setToolsOpen(true);
  }, []);

  const setBreadcrumbLabel = useCallback((segment: string, label: string) => {
    setBreadcrumbLabels((current) =>
      current[segment] === label ? current : { ...current, [segment]: label },
    );
  }, []);

  const value = useMemo(
    () => ({
      helpContent,
      toolsOpen,
      setToolsOpen,
      openHelp,
      breadcrumbLabels,
      setBreadcrumbLabel,
    }),
    [helpContent, toolsOpen, openHelp, breadcrumbLabels, setBreadcrumbLabel],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside <ShellProvider>");
  return context;
}

/** Shows `label` (e.g. a zone name) instead of a raw path segment in the breadcrumbs. */
export function useBreadcrumbLabel(segment: string | undefined, label: string | undefined) {
  const { setBreadcrumbLabel } = useShell();
  useEffect(() => {
    if (segment && label) setBreadcrumbLabel(segment, label);
  }, [segment, label, setBreadcrumbLabel]);
}
