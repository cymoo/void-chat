import type { User } from "@/api/types";

interface MentionDropdownProps {
  results: User[];
  selectedIndex: number;
  onSelect: (username: string) => void;
}

export function MentionDropdown({ results, selectedIndex, onSelect }: MentionDropdownProps) {
  if (results.length === 0) return null;

  return (
    <div className="mention-dropdown" role="listbox" aria-label="User mention suggestions">
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
}
