export type ThemeId = "terminal" | "one-dark" | "quiet-light" | "nord" | "teal";

export interface Theme {
  id: ThemeId;
  label: string;
}

export const THEMES: Theme[] = [
  { id: "terminal", label: "Terminal" },
  { id: "one-dark", label: "One Dark" },
  { id: "quiet-light", label: "Quiet Light" },
  { id: "nord", label: "Nord" },
  { id: "teal", label: "Teal" },
];
