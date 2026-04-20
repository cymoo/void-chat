import type { ThemeId } from "./themes";
import { THEMES } from "./themes";

export const THEME_STORAGE_KEY = "void-chat-theme";

export function getInitialTheme(): ThemeId {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && THEMES.some((t) => t.id === stored)) {
    return stored as ThemeId;
  }
  return "terminal";
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function saveTheme(theme: ThemeId): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
