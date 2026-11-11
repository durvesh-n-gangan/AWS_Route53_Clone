import { fireEvent, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTargetFor } from "@/lib/navigation";
import { isTypingTarget, useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("runs the handler for a single key press on the page", () => {
    const create = vi.fn();
    renderHook(() => useKeyboardShortcuts({ c: create }));

    fireEvent.keyDown(document.body, { key: "c" });
    fireEvent.keyDown(document.body, { key: "C" });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it("ignores keys typed into fields and keys with modifiers", () => {
    const refresh = vi.fn();
    renderHook(() => useKeyboardShortcuts({ r: refresh }));
    const { getByRole } = render(<input aria-label="name" />);

    fireEvent.keyDown(getByRole("textbox"), { key: "r" });
    fireEvent.keyDown(document.body, { key: "r", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "r", metaKey: true });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("pauses while a modal dialog is open", () => {
    const help = vi.fn();
    renderHook(() => useKeyboardShortcuts({ "?": help }));
    render(<div role="dialog" aria-modal="true" />);

    fireEvent.keyDown(document.body, { key: "?" });

    expect(help).not.toHaveBeenCalled();
  });

  it.each([
    ["<textarea></textarea>", true],
    ["<select></select>", true],
    ['<input type="text" />', true],
    ['<input type="checkbox" />', false],
    ["<button></button>", false],
    ['<div contenteditable="true"></div>', true],
  ])("treats %s as typing: %s", (html, expected) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    const element = host.firstElementChild as HTMLElement;
    if (html.includes("contenteditable")) Object.defineProperty(element, "isContentEditable", { value: true });
    expect(isTypingTarget(element)).toBe(expected);
  });
});

describe("createTargetFor", () => {
  it.each([
    ["/route53/v2/hostedzones", "/route53/v2/hostedzones/create"],
    ["/route53/v2/hostedzones/Z123", "/route53/v2/hostedzones/Z123/records/create"],
    ["/route53/v2/hostedzones/create", null],
    ["/route53/v2/hostedzones/Z123/edit", null],
    ["/route53/v2/home", null],
  ])("%s -> %s", (path, target) => {
    expect(createTargetFor(path)).toBe(target);
  });
});
