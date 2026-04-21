import {
  useCallback,
  useRef,
  type KeyboardEvent,
} from "react";
import { Paperclip, Send } from "lucide-react";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
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

  // Grid ref used to route keyboard events in colon-triggered emoji mode
  const emojiGridRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (onKeyDownCapture?.(e, composer)) return;

      // In colon mode the textarea keeps focus; forward navigation keys to the emoji grid
      if (composer.emojiOpen && composer.emojiColonMode) {
        const routed = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"];
        if (routed.includes(e.key)) {
          e.preventDefault();
          emojiGridRef.current?.dispatchEvent(
            new KeyboardEvent("keydown", { key: e.key, bubbles: true, cancelable: true }),
          );
          return;
        }
      }

      composer.handleKeyDown(e);
    },
    [onKeyDownCapture, composer],
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
            <EmojiPicker
              open={composer.emojiOpen}
              onToggle={composer.setEmojiOpen}
              onSelect={composer.handleSelectEmoji}
              anchorEl={composer.emojiColonMode ? composer.textareaRef.current : null}
              gridRef={emojiGridRef}
            />
            <label className="icon-btn attach-btn" title="Attach File">
              <Paperclip size={20} />
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
            <Send size={20} />
          </button>
        </div>
        {hintText && <div className="input-hint">{hintText}</div>}
      </div>
    </>
  );
}
