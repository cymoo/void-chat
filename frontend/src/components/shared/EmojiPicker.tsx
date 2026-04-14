import { useRef, useEffect } from "react";
import { COMMON_EMOJIS } from "@/lib/emojis";

interface EmojiPickerProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ open, onToggle, onSelect }: EmojiPickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onToggle(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div className="emoji-picker-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`icon-btn emoji-toggle-btn${open ? " active" : ""}`}
        title="Insert Emoji"
        aria-label="Insert emoji"
        onClick={() => onToggle(!open)}
      >
        🙂
      </button>
      {open && (
        <div className="emoji-picker" role="menu" aria-label="Emoji picker">
          <div className="emoji-grid">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                aria-label={`Emoji ${emoji}`}
                onClick={() => onSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
