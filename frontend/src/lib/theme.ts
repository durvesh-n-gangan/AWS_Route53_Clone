"use client";

import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "r53-theme";
const CHANGE_EVENT = "r53-theme-change";
const DARK_CLASS = "awsui-dark-mode";

/**
 * Runs inline at the top of <body>, before React renders, so a saved dark theme is applied
 * without a flash of the light one. Storage can be blocked (private mode), hence try/catch.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")==="dark"){document.body.classList.add("${DARK_CLASS}")}}catch(e){}`;

export function readStoredMode(): ThemeMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setThemeMode(mode: ThemeMode): void {
  applyMode(mode === "dark" ? Mode.Dark : Mode.Light);
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not persisted when storage is unavailable; the choice still applies to this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** The mode currently applied to the page (the body class is the source of truth). */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    subscribe,
    () => (document.body.classList.contains(DARK_CLASS) ? "dark" : "light"),
    () => "light",
  );
}
