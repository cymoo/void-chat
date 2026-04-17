import { COMMON_EMOJIS } from "@/lib/emojis";
import { Popover } from "@/components/ui/Popover";

interface EmojiPickerProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ open, onToggle, onSelect }: EmojiPickerProps) {
  const emojiGrid = (
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
