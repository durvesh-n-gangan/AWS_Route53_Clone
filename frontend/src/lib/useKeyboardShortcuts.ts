"use client";

import { useEffect, useRef } from "react";

export type ShortcutHandlers = Partial<Record<string, () => void>>;

/** True when the key press belongs to a text field rather than the page. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "reset"].includes(type);
}

/**
 * Single-key shortcuts ("/", "c", "r", "?"). Ignored while typing in a field, with Ctrl, Cmd
 * or Alt held (so browser shortcuts keep working), and while a dialog is open.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const handler = latest.current[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? latest.current[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
