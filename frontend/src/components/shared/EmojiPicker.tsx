import { useState, useCallback, type KeyboardEvent } from "react";
import { COMMON_EMOJIS } from "@/lib/emojis";
import { Popover } from "@/components/ui/Popover";

const COLS = 8;

interface EmojiPickerProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ open, onToggle, onSelect }: EmojiPickerProps) {
  const [focusIndex, setFocusIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const total = COMMON_EMOJIS.length;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setFocusIndex((i) => (i + 1) % total);
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusIndex((i) => (i - 1 + total) % total);
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => Math.min(i + COLS, total - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => Math.max(i - COLS, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onSelect(COMMON_EMOJIS[focusIndex]!);
          break;
        case "Escape":
          e.preventDefault();
          onToggle(false);
          break;
      }
    },
    [focusIndex, onSelect, onToggle],
  );

  const emojiGrid = (
    <div className="emoji-picker" role="grid" aria-label="Emoji picker" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="emoji-grid">
        {COMMON_EMOJIS.map((emoji, i) => (
          <button
            key={emoji}
            type="button"
            className={`emoji-btn${i === focusIndex ? " emoji-btn-focused" : ""}`}
            aria-label={`Emoji ${emoji}`}
            tabIndex={-1}
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onToggle}
      content={emojiGrid}
      placement="top-end"
      offsetPx={8}
      className="emoji-popover"
    >
      <button
        type="button"
        className={`icon-btn emoji-toggle-btn${open ? " active" : ""}`}
        title="Insert Emoji"
        aria-label="Insert emoji"
      >
        🙂
      </button>
    </Popover>
  );
}
