import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import {
  useFloating,
  useDismiss,
  useInteractions,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
} from "@floating-ui/react";
import { COMMON_EMOJIS } from "@/lib/emojis";

/** Grid columns must match CSS grid-template-columns: repeat(5, ...) in input.css */
const COLS = 5;

interface EmojiPickerProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  /** When provided, the picker is anchored to this element instead of the trigger button.
   *  Used when the picker is opened via ':' shortcut so it appears near the textarea. */
  anchorEl?: Element | null;
  /** Expose the emoji grid DOM node so the parent can route keyboard events to it in caret mode. */
  gridRef?: React.RefObject<HTMLDivElement | null>;
}

export function EmojiPicker({ open, onToggle, onSelect, anchorEl, gridRef }: EmojiPickerProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const internalGridRef = useRef<HTMLDivElement | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: onToggle,
    placement: (anchorEl ? "top-start" : "top-end") as Placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    // In caret mode use the textarea as reference; otherwise the trigger button is set via refs.setReference
    elements: anchorEl ? { reference: anchorEl } : undefined,
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // In button mode: move focus into the grid after the popover renders
  useEffect(() => {
    if (open) {
      setFocusIndex(0);
      if (!anchorEl) {
        requestAnimationFrame(() => internalGridRef.current?.focus());
      }
    }
  }, [open, anchorEl]);

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

  const setGridRef = (el: HTMLDivElement | null) => {
    internalGridRef.current = el;
    if (gridRef) gridRef.current = el;
  };

  const emojiGrid = (
    <div
      ref={setGridRef}
      className="emoji-picker"
      role="grid"
      aria-label="Emoji picker"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
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

  const floatingContent = (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="popover-content emoji-popover"
      {...getFloatingProps()}
    >
      {emojiGrid}
    </div>
  );

  return (
    <>
      <button
        ref={anchorEl ? undefined : refs.setReference}
        {...(anchorEl ? {} : getReferenceProps())}
        type="button"
        className={`icon-btn emoji-toggle-btn${open ? " active" : ""}`}
        title="Insert Emoji"
        aria-label="Insert emoji"
        onClick={() => onToggle(!open)}
      >
        🙂
      </button>
      {open && (
        <FloatingPortal>
          {anchorEl ? (
            floatingContent
          ) : (
            <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
              {floatingContent}
            </FloatingFocusManager>
          )}
        </FloatingPortal>
      )}
    </>
  );
}
