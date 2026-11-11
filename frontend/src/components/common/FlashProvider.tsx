"use client";

import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** What callers pass in; the provider fills in the id and dismiss handling. */
export type FlashInput = Omit<FlashbarProps.MessageDefinition, "id" | "onDismiss"> & {
  id?: string;
};

interface FlashContextValue {
  items: FlashbarProps.MessageDefinition[];
  /** Shows a message (replacing one with the same id) and returns its id. */
  addFlash: (message: FlashInput) => string;
  dismissFlash: (id: string) => void;
  clearFlashes: () => void;
}

const FlashContext = createContext<FlashContextValue | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FlashInput[]>([]);
  const nextId = useRef(0);

  const dismissFlash = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const addFlash = useCallback((message: FlashInput) => {
    nextId.current += 1;
    const id = message.id ?? `flash-${nextId.current}`;
    setMessages((current) => [
      { dismissible: true, ...message, id },
      ...current.filter((existing) => existing.id !== id),
    ]);
    return id;
  }, []);

  const clearFlashes = useCallback(() => setMessages([]), []);

  const items = useMemo<FlashbarProps.MessageDefinition[]>(
    () =>
      messages.map((message) => ({
        dismissLabel: "Dismiss message",
        ...message,
        onDismiss: message.dismissible ? () => dismissFlash(message.id as string) : undefined,
      })),
    [messages, dismissFlash],
  );

  const value = useMemo(
    () => ({ items, addFlash, dismissFlash, clearFlashes }),
    [items, addFlash, dismissFlash, clearFlashes],
  );

  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function useFlash(): FlashContextValue {
  const context = useContext(FlashContext);
  if (!context) throw new Error("useFlash must be used inside <FlashProvider>");
  return context;
}
