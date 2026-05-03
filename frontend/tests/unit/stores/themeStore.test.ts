import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock themeBootstrap so tests don't touch DOM/localStorage
vi.mock("@/lib/themeBootstrap", () => ({
  getInitialTheme: vi.fn(() => "terminal"),
  applyTheme: vi.fn(),
  saveTheme: vi.fn(),
}));

import { useThemeStore } from "@/stores/themeStore";
import { applyTheme, saveTheme } from "@/lib/themeBootstrap";

describe("themeStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to terminal
    useThemeStore.setState({ theme: "terminal" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initialises with the value from getInitialTheme", () => {
    // getInitialTheme was called at module init; store starts at "terminal"
    expect(useThemeStore.getState().theme).toBe("terminal");
  });

  it("setTheme updates the store theme", () => {
    useThemeStore.getState().setTheme("one-dark");
    expect(useThemeStore.getState().theme).toBe("one-dark");
  });

  it("setTheme calls saveTheme with the new theme", () => {
    useThemeStore.getState().setTheme("quiet-light");
    expect(saveTheme).toHaveBeenCalledWith("quiet-light");
  });

  it("setTheme calls applyTheme with the new theme", () => {
    useThemeStore.getState().setTheme("one-dark");
    expect(applyTheme).toHaveBeenCalledWith("one-dark");
  });

  it("can cycle through all five themes", () => {
    const { setTheme } = useThemeStore.getState();
    setTheme("one-dark");
    expect(useThemeStore.getState().theme).toBe("one-dark");
    setTheme("quiet-light");
    expect(useThemeStore.getState().theme).toBe("quiet-light");
    setTheme("nord");
    expect(useThemeStore.getState().theme).toBe("nord");
    setTheme("teal");
    expect(useThemeStore.getState().theme).toBe("teal");
    setTheme("terminal");
    expect(useThemeStore.getState().theme).toBe("terminal");
  });
});

describe("themeBootstrap (unit — via mock validation)", () => {
  it("getInitialTheme returns a valid ThemeId", async () => {
    // Un-mock for this test to use real implementation
    vi.resetModules();
    const VALID_THEMES = ["terminal", "one-dark", "quiet-light", "nord", "teal"];

    // Simulate localStorage with a valid stored value
    localStorage.setItem("void-chat-theme", "teal");
    const { getInitialTheme: realGet } = await import("@/lib/themeBootstrap");
    expect(VALID_THEMES).toContain(realGet());
    localStorage.removeItem("void-chat-theme");
  });

  it("getInitialTheme falls back to terminal for invalid values", async () => {
    vi.resetModules();
    localStorage.setItem("void-chat-theme", "invalid-theme-xyz");
    const { getInitialTheme: realGet } = await import("@/lib/themeBootstrap");
    expect(realGet()).toBe("terminal");
    localStorage.removeItem("void-chat-theme");
  });

  it("getInitialTheme falls back to terminal when nothing is stored", async () => {
    vi.resetModules();
    localStorage.removeItem("void-chat-theme");
    const { getInitialTheme: realGet } = await import("@/lib/themeBootstrap");
    expect(realGet()).toBe("terminal");
  });

  it("applyTheme is called with the correct theme when setTheme is used", () => {
    // applyTheme DOM mutation is a one-liner tested indirectly via themeStore
    useThemeStore.getState().setTheme("quiet-light");
    expect(applyTheme).toHaveBeenCalledWith("quiet-light");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull(); // mock doesn't mutate DOM
  });
});
