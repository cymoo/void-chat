import {
  useRef,
  useEffect,
} from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";
import type { User } from "@/api/types";

interface MentionDropdownProps {
  results: User[];
  selectedIndex: number;
  onSelect: (username: string) => void;
  onClose?: () => void;
  /** The textarea element to anchor the dropdown to */
  anchorEl?: HTMLElement | null;
}

export function MentionDropdown({ results, selectedIndex, onSelect, onClose, anchorEl }: MentionDropdownProps) {
  const { refs, floatingStyles } = useFloating({
    placement: "top-start" as Placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: anchorEl ?? undefined,
    },
  });

  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const floatingRef = refs.floating;

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Click-outside-to-close
  useEffect(() => {
    if (results.length === 0 || !onClose) return;
    const handler = (e: MouseEvent) => {
      const floating = typeof floatingRef === "function" ? null : floatingRef?.current;
      if (floating && !floating.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [results.length, onClose, floatingRef]);

  if (results.length === 0) return null;

  const dropdown = (
    <div
      ref={refs.setFloating}
      className="mention-dropdown"
      role="listbox"
      aria-label="User mention suggestions"
      style={anchorEl ? floatingStyles : undefined}
    >
      {results.map((u, i) => (
        <div
          key={u.id}
          ref={(el) => { if (el) itemRefs.current.set(i, el); else itemRefs.current.delete(i); }}
          className={`mention-item${i === selectedIndex ? " selected" : ""}`}
          role="option"
          aria-selected={i === selectedIndex}
          onClick={() => onSelect(u.displayName ?? u.username)}
        >
          <span className="mention-item-name">{u.displayName ?? u.username}</span>
        </div>
      ))}
    </div>
  );

  // When anchored to a textarea, render in a portal for correct stacking
  if (anchorEl) {
    return <FloatingPortal>{dropdown}</FloatingPortal>;
  }

  return dropdown;
}
