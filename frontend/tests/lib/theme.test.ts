import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readStoredMode, setThemeMode, THEME_INIT_SCRIPT, useThemeMode } from "@/lib/theme";

afterEach(() => {
  document.body.classList.remove("awsui-dark-mode");
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("dark mode", () => {
  it("applies Cloudscape dark mode and remembers the choice", () => {
    setThemeMode("dark");

    expect(document.body).toHaveClass("awsui-dark-mode");
    expect(readStoredMode()).toBe("dark");

    setThemeMode("light");
    expect(document.body).not.toHaveClass("awsui-dark-mode");
    expect(readStoredMode()).toBe("light");
  });

  it("restores a saved dark theme before React renders", () => {
    window.localStorage.setItem("r53-theme", "dark");

    new Function(THEME_INIT_SCRIPT)();

    expect(document.body).toHaveClass("awsui-dark-mode");
  });

  it("keeps working when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setThemeMode("dark")).not.toThrow();
    expect(document.body).toHaveClass("awsui-dark-mode");
    expect(readStoredMode()).toBe("light");
    expect(() => new Function(THEME_INIT_SCRIPT)()).not.toThrow();
  });

  it("re-renders subscribers when the mode changes", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("light");

    act(() => setThemeMode("dark"));

    expect(result.current).toBe("dark");
  });
});
