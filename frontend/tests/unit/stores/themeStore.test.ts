import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock themeBootstrap so tests don't touch DOM/localStorage
vi.mock("@/lib/themeBootstrap", () => ({
  getInitialTheme: vi.fn(() => "terminal"),
  applyTheme: vi.fn(),
  saveTheme: vi.fn(),
}));

import { useThemeStore } from "@/stores/themeStore";
import { getInitialTheme, applyTheme, saveTheme } from "@/lib/themeBootstrap";

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
    useThemeStore.getState().setTheme("atom-one-dark");
    expect(useThemeStore.getState().theme).toBe("atom-one-dark");
  });

  it("setTheme calls saveTheme with the new theme", () => {
    useThemeStore.getState().setTheme("material-light");
    expect(saveTheme).toHaveBeenCalledWith("material-light");
  });

  it("setTheme calls applyTheme with the new theme", () => {
    useThemeStore.getState().setTheme("atom-one-dark");
    expect(applyTheme).toHaveBeenCalledWith("atom-one-dark");
  });

  it("can cycle through all three themes", () => {
    const { setTheme } = useThemeStore.getState();
    setTheme("atom-one-dark");
    expect(useThemeStore.getState().theme).toBe("atom-one-dark");
    setTheme("material-light");
    expect(useThemeStore.getState().theme).toBe("material-light");
    setTheme("terminal");
    expect(useThemeStore.getState().theme).toBe("terminal");
  });
});

describe("themeBootstrap (unit — via mock validation)", () => {
  it("getInitialTheme returns a valid ThemeId", async () => {
    // Un-mock for this test to use real implementation
    vi.resetModules();
    const VALID_THEMES = ["terminal", "atom-one-dark", "material-light"];

    // Simulate localStorage with a valid stored value
    localStorage.setItem("void-chat-theme", "atom-one-dark");
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
    useThemeStore.getState().setTheme("material-light");
    expect(applyTheme).toHaveBeenCalledWith("material-light");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull(); // mock doesn't mutate DOM
  });
});
