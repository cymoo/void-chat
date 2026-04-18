import {
  useCallback,
  type KeyboardEvent,
} from "react";
import { COMMON_EMOJIS } from "@/lib/emojis";
import { Popover } from "@/components/ui/Popover";
import { useMessageComposer, type MessageComposerReturn } from "@/hooks/useMessageComposer";

interface MessageInputBarProps {
  onSubmit: (text: string) => void;
  onImageUploaded: (url: string, thumbnailUrl?: string, width?: number, height?: number) => void;
  onFileUploaded: (fileName: string, fileUrl: string, fileSize: number, mimeType: string) => void;
  onTextChange?: (text: string, textarea: HTMLTextAreaElement | null) => void;
  /** If provided, the bar exposes its composer via this ref so the parent can call setText/focus. */
  composerRef?: React.MutableRefObject<MessageComposerReturn | null>;
  placeholder?: string;
  hintText?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  /** Extra keyboard handler run before the default Enter-to-send. Return true to prevent default. */
  onKeyDownCapture?: (e: KeyboardEvent<HTMLTextAreaElement>, composer: MessageComposerReturn) => boolean;
  /** Render slot above the input panel (e.g. reply/edit indicator, mention dropdown). */
  renderAbove?: (composer: MessageComposerReturn) => React.ReactNode;
}

export function MessageInputBar({
  onSubmit,
  onImageUploaded,
  onFileUploaded,
  onTextChange,
  composerRef,
  placeholder = "Message...",
  hintText,
  autoFocus,
  ariaLabel,
  onKeyDownCapture,
  renderAbove,
}: MessageInputBarProps) {
  const composer = useMessageComposer({
    onSubmit,
    onImageUploaded,
    onFileUploaded,
    onTextChange,
  });

  // Expose composer to parent if requested
  if (composerRef) {
    composerRef.current = composer;
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (onKeyDownCapture?.(e, composer)) return;
      composer.handleKeyDown(e);
    },
    [onKeyDownCapture, composer],
  );

  const emojiGrid = (
    <div className="emoji-picker" role="menu" aria-label="Emoji picker">
      <div className="emoji-grid">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-btn"
            onClick={() => composer.handleSelectEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {renderAbove?.(composer)}

      {/* Upload progress indicator */}
      {composer.uploading && (
        <div className="upload-indicator">
          <span className="upload-spinner" />
          <span>Uploading...</span>
        </div>
      )}

      <div className="input-panel">
        <div className="input-wrapper">
          <textarea
            ref={composer.textareaRef}
            className="message-input"
            placeholder={placeholder}
            autoComplete="off"
            rows={1}
            value={composer.text}
            onChange={composer.handleChange}
            onKeyDown={handleKeyDown}
            onPaste={composer.handlePaste}
            autoFocus={autoFocus}
            aria-label={ariaLabel}
          />
          <div className="input-actions">
            <Popover
              open={composer.emojiOpen}
              onOpenChange={composer.setEmojiOpen}
              content={emojiGrid}
              placement="top-end"
              offsetPx={8}
              className="emoji-popover"
            >
              <button
                type="button"
                className={`icon-btn emoji-toggle-btn${composer.emojiOpen ? " active" : ""}`}
                title="Insert Emoji"
                aria-label="Insert emoji"
              >
                🙂
              </button>
            </Popover>
            <label className="icon-btn attach-btn" title="Attach File">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <input
                type="file"
                style={{ display: "none" }}
                onChange={composer.handleAttach}
              />
            </label>
          </div>
          <button
            type="button"
            className="icon-btn send-btn"
            onClick={composer.handleSend}
            disabled={!composer.canSend}
            aria-label={ariaLabel ? `Send ${ariaLabel}` : "Send message"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {hintText && <div className="input-hint">{hintText}</div>}
      </div>
    </>
  );
}
