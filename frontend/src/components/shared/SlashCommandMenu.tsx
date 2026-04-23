import { useRef, useEffect } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";
import type { SlashCommand } from "@/lib/slashCommands";

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose?: () => void;
  anchorEl?: HTMLElement | null;
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onClose,
  anchorEl,
}: SlashCommandMenuProps) {
  const { refs, floatingStyles } = useFloating({
    placement: "top-start" as Placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl ?? undefined },
  });

  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const floatingRef = refs.floating;

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (commands.length === 0 || !onClose) return;
    const handler = (e: MouseEvent) => {
      const floating = typeof floatingRef === "function" ? null : floatingRef?.current;
      if (floating && !floating.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [commands.length, onClose, floatingRef]);

  if (commands.length === 0) return null;

  const dropdown = (
    <div
      ref={refs.setFloating}
      className="slash-command-menu"
      role="listbox"
      aria-label="Slash command suggestions"
      style={anchorEl ? floatingStyles : undefined}
    >
      {commands.map((cmd, i) => (
        <div
          key={cmd.name}
          ref={(el) => {
            if (el) itemRefs.current.set(i, el);
            else itemRefs.current.delete(i);
          }}
          className={`slash-command-item${i === selectedIndex ? " selected" : ""}`}
          role="option"
          aria-selected={i === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(cmd);
          }}
        >
          <span className="slash-command-name">/{cmd.name}</span>
          <span className="slash-command-desc">{cmd.description}</span>
        </div>
      ))}
    </div>
  );

  if (anchorEl) {
    return <FloatingPortal>{dropdown}</FloatingPortal>;
  }
  return dropdown;
}
