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

/** A stored message; `seen` becomes true once a page navigation has displayed it. */
type StoredFlash = FlashInput & { id: string; seen: boolean };

interface FlashContextValue {
  items: FlashbarProps.MessageDefinition[];
  /** Shows a message (replacing one with the same id) and returns its id. */
  addFlash: (message: FlashInput) => string;
  dismissFlash: (id: string) => void;
  clearFlashes: () => void;
  /**
   * Call on every route change. Messages live for one navigation, like the console: a
   * "created" message raised just before a redirect shows on the next page, then goes.
   */
  onNavigate: () => void;
}

const FlashContext = createContext<FlashContextValue | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<StoredFlash[]>([]);
  const nextId = useRef(0);

  const dismissFlash = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const addFlash = useCallback((message: FlashInput) => {
    nextId.current += 1;
    const id = message.id ?? `flash-${nextId.current}`;
    setMessages((current) => [
      { dismissible: true, ...message, id, seen: false },
      ...current.filter((existing) => existing.id !== id),
    ]);
    return id;
  }, []);

  const clearFlashes = useCallback(() => setMessages([]), []);

  const onNavigate = useCallback(() => {
    setMessages((current) =>
      current.length === 0
        ? current
        : current.filter((message) => !message.seen).map((message) => ({ ...message, seen: true })),
    );
  }, []);

  const items = useMemo<FlashbarProps.MessageDefinition[]>(
    () =>
      messages.map(({ seen: _seen, ...message }) => ({
        dismissLabel: "Dismiss message",
        ...message,
        onDismiss: message.dismissible ? () => dismissFlash(message.id) : undefined,
      })),
    [messages, dismissFlash],
  );

  const value = useMemo(
    () => ({ items, addFlash, dismissFlash, clearFlashes, onNavigate }),
    [items, addFlash, dismissFlash, clearFlashes, onNavigate],
  );

  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function useFlash(): FlashContextValue {
  const context = useContext(FlashContext);
  if (!context) throw new Error("useFlash must be used inside <FlashProvider>");
  return context;
}
