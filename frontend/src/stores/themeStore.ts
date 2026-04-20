import { create } from "zustand";
import { type ThemeId } from "@/lib/themes";
import { getInitialTheme, applyTheme, saveTheme } from "@/lib/themeBootstrap";

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    saveTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
}));
