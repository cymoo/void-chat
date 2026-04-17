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
  /** The textarea element to anchor the dropdown to */
  anchorEl?: HTMLElement | null;
}

export function MentionDropdown({ results, selectedIndex, onSelect, anchorEl }: MentionDropdownProps) {
  const { refs, floatingStyles } = useFloating({
    placement: "top-start" as Placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: anchorEl ?? undefined,
    },
  });

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
          className={`mention-item${i === selectedIndex ? " selected" : ""}`}
          role="option"
          aria-selected={i === selectedIndex}
          onClick={() => onSelect(u.username)}
        >
          <span className="mention-item-name">{u.username}</span>
          <span className="mention-item-username">@{u.username}</span>
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
