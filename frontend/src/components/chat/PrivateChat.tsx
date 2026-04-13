import {
  memo,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { COMMON_EMOJIS } from "@/lib/emojis";
import { renderMarkdown } from "@/lib/markdown";
import { formatTime } from "@/lib/utils";
import { useMessageComposer } from "@/hooks/useMessageComposer";
import { MessageContent } from "@/components/chat/MessageContent";
import type { PrivateMessage, User, WsSendPayload } from "@/api/types";

interface PrivateChatProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

interface PrivateMessageItemProps {
  message: PrivateMessage;
  currentUserId: number;
  onImageOpen: (url: string | null) => void;
}

const PrivateMessageItem = memo(
  ({ message, currentUserId, onImageOpen }: PrivateMessageItemProps) => {
    const isSelf = message.senderId === currentUserId;
    const textHtml = useMemo(() => {
      if (message.messageType !== "text") return null;
      return renderMarkdown(message.content ?? "");
    }, [message]);

    const renderContent = () => {
      if (message.messageType === "text") {
        return (
          <MessageContent
            type="text"
            contentHtml={textHtml ?? ""}
            textClassName="private-msg-content"
          />
        );
      }
      if (message.messageType === "image") {
        return (
          <MessageContent
            type="image"
            imageUrl={message.fileUrl ?? ""}
            onImageClick={(url) => onImageOpen(url)}
            textClassName="private-msg-content"
          />
        );
      }
      if (message.messageType === "file") {
        return (
          <MessageContent
            type="file"
            fileName={message.fileName ?? ""}
            fileUrl={message.fileUrl ?? ""}
            fileSize={message.fileSize ?? 0}
            textClassName="private-msg-content"
          />
        );
      }
      return null;
    };

    return (
      <div
        className={`private-msg ${isSelf ? "private-msg-self" : "private-msg-other"}`}
      >
        <div className="private-msg-meta">
          <div className="private-msg-author">{isSelf ? "You" : message.senderUsername}</div>
          <div className="private-msg-time">{formatTime(message.timestamp)}</div>
        </div>
        {renderContent()}
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.currentUserId === next.currentUserId &&
    prev.onImageOpen === next.onImageOpen,
);

export function PrivateChat({ send, currentUser }: PrivateChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);
  const setImageModal = useUiStore((s) => s.setImageModal);

  const handleClose = useCallback(() => {
    if (privateChatUserId) {
      send({ type: "mark_read", targetUserId: privateChatUserId });
    }
    closePrivateChat();
  }, [privateChatUserId, send, closePrivateChat]);

  const handleOpenImage = useCallback(
    (url: string | null) => setImageModal(url),
    [setImageModal],
  );

  const syncToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, []);

  useEffect(() => {
    syncToBottom();
  }, [privateMessages, syncToBottom]);

  const onSubmit = useCallback(
    (text: string) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, content: text });
    },
    [privateChatUserId, send],
  );

  const onImageUploaded = useCallback(
    (url: string, thumbnailUrl?: string) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, imageUrl: url, thumbnailUrl });
    },
    [privateChatUserId, send],
  );

  const onFileUploaded = useCallback(
    (fileName: string, fileUrl: string, fileSize: number, mimeType: string) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, fileName, fileUrl, fileSize, mimeType });
    },
    [privateChatUserId, send],
  );

  const composer = useMessageComposer({ onSubmit, onImageUploaded, onFileUploaded });

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="private-chat-panel">
        <div className="private-chat-header">
          <span>DM: {privateChatUsername}</span>
          <button className="modal-close panel-close-btn" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="private-chat-messages" ref={messagesContainerRef}>
          {privateMessages.map((msg) => (
            <PrivateMessageItem
              key={msg.id}
              message={msg}
              currentUserId={currentUser.id}
              onImageOpen={handleOpenImage}
            />
          ))}
        </div>
        <div className="private-chat-input">
          <textarea
            ref={composer.textareaRef}
            className="message-input"
            placeholder="Message..."
            autoComplete="off"
            rows={1}
            value={composer.text}
            onChange={composer.handleChange}
            onKeyDown={composer.handleKeyDown}
            onPaste={composer.handlePaste}
            autoFocus
            aria-label="Type a direct message"
          />
          <div className="emoji-picker-wrapper" ref={composer.emojiPickerRef}>
            <button
              type="button"
              className={`icon-btn emoji-toggle-btn${composer.emojiOpen ? " active" : ""}`}
              title="Insert Emoji"
              aria-label="Insert emoji"
              onClick={() => composer.setEmojiOpen(!composer.emojiOpen)}
            >
              🙂
            </button>
            {composer.emojiOpen && (
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
            )}
          </div>
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
          <button
            type="button"
            className="icon-btn send-btn"
            onClick={composer.handleSend}
            disabled={!composer.canSend}
            aria-label="Send direct message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="private-chat-hint">
          <kbd>Enter</kbd> send • <kbd>Shift+Enter</kbd> new line • Paste image / emoji supported
        </div>
      </div>
    </div>
  );
}
