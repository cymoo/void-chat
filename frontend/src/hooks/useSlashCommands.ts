import { useState, useCallback } from "react";
import { filterCommands, type SlashCommand, type CommandScope } from "@/lib/slashCommands";

/** Regex: input is exactly a slash optionally followed by lowercase letters. */
const SLASH_PATTERN = /^\/[a-z]*$/;

interface UseSlashCommandsResult {
  menuOpen: boolean;
  query: string;
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  /** Call on every text change to update menu state. */
  onTextChange: (text: string) => void;
  /** Navigate up/down and select with keyboard. Returns true if the event was consumed. */
  onKeyDown: (e: React.KeyboardEvent) => boolean;
  closeMenu: () => void;
}

/**
 * Lean slash-command detection hook.
 * Only handles state — command execution is left to the caller.
 */
export function useSlashCommands(scope: CommandScope): UseSlashCommandsResult {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onTextChange = useCallback(
    (text: string) => {
      if (SLASH_PATTERN.test(text)) {
        const q = text.slice(1); // strip leading '/'
        const cmds = filterCommands(q, scope);
        setQuery(q);
        setFilteredCommands(cmds);
        setMenuOpen(cmds.length > 0);
        setSelectedIndex(0);
      } else {
        setMenuOpen(false);
        setQuery("");
        setFilteredCommands([]);
      }
    },
    [scope],
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setQuery("");
    setFilteredCommands([]);
    setSelectedIndex(0);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!menuOpen || filteredCommands.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return true;
      }
      // Tab or Enter will be handled by the caller with the selected command
      return false;
    },
    [menuOpen, filteredCommands.length, closeMenu],
  );

  return { menuOpen, query, filteredCommands, selectedIndex, onTextChange, onKeyDown, closeMenu };
}
