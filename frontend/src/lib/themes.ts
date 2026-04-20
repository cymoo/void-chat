export type ThemeId = "terminal" | "atom-one-dark" | "material-light";

export interface Theme {
  id: ThemeId;
  label: string;
}

export const THEMES: Theme[] = [
  { id: "terminal", label: "Terminal" },
  { id: "atom-one-dark", label: "Atom One Dark" },
  { id: "material-light", label: "Material Light" },
];
