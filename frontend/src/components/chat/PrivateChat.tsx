import {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { COMMON_EMOJIS } from "@/lib/emojis";
import { renderMarkdown } from "@/lib/markdown";
import { formatTime, formatFileSize } from "@/lib/utils";
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

    return (
      <div
        className={`private-msg ${isSelf ? "private-msg-self" : "private-msg-other"}`}
      >
        <div className="private-msg-meta">
          <div className="private-msg-author">{isSelf ? "You" : message.senderUsername}</div>
          <div className="private-msg-time">{formatTime(message.timestamp)}</div>
        </div>
        {message.messageType === "text" && (
          <div
            className="private-msg-content markdown-body"
            dangerouslySetInnerHTML={{
              __html: textHtml ?? "",
            }}
          />
        )}
        {message.messageType === "image" && (
          <>
            <div className="private-msg-content">shared an image</div>
            <img
              src={message.fileUrl ?? ""}
              className="message-image"
              onClick={() => onImageOpen(message.fileUrl ?? null)}
              alt="Shared image"
            />
          </>
        )}
        {message.messageType === "file" && (
          <>
            <div className="private-msg-content">shared a file</div>
            <div className="message-file">
              <div className="file-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
              </div>
              <div className="file-info">
                <div className="file-name">{message.fileName}</div>
                <div className="file-size">{formatFileSize(message.fileSize ?? 0)}</div>
              </div>
              <a href={message.fileUrl ?? ""} download className="file-download">
                DOWNLOAD
              </a>
            </div>
          </>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.currentUserId === next.currentUserId &&
    prev.onImageOpen === next.onImageOpen,
);

export function PrivateChat({ send, currentUser }: PrivateChatProps) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);
  const setImageModal = useUiStore((s) => s.setImageModal);
  const addToast = useUiStore((s) => s.addToast);
  const canSend = text.trim().length > 0;

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

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  useEffect(() => {
    if (!emojiOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!emojiPickerRef.current?.contains(target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [emojiOpen]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !privateChatUserId) return;
    send({
      type: "private_message",
      targetUserId: privateChatUserId,
      content: trimmed,
    });
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertAtCursor = useCallback(
    (content: string) => {
      const el = textareaRef.current;
      if (!el) {
        setText((prev) => prev + content);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextValue = `${text.slice(0, start)}${content}${text.slice(end)}`;
      setText(nextValue);
      requestAnimationFrame(() => {
        const caret = start + content.length;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [text],
  );

  const handleSelectEmoji = (emoji: string) => {
    insertAtCursor(emoji);
    setEmojiOpen(false);
  };

  const sendPrivateImage = useCallback(
    async (file: File) => {
      if (!privateChatUserId) return;
      try {
        const result = await api.uploadImage(file);
        if (result.url) {
          send({
            type: "private_message",
            targetUserId: privateChatUserId,
            imageUrl: result.url,
            thumbnailUrl: result.thumbnail ?? undefined,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "图片上传失败";
        addToast(msg, "error");
      }
    },
    [addToast, privateChatUserId, send],
  );

  const handleAttach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !privateChatUserId) return;
    if (file.type.startsWith("image/")) {
      await sendPrivateImage(file);
    } else {
      try {
        const result = await api.uploadFile(file);
        if (result.url) {
          send({
            type: "private_message",
            targetUserId: privateChatUserId,
            fileName: result.fileName ?? file.name,
            fileUrl: result.url,
            fileSize: result.fileSize ?? file.size,
            mimeType: file.type,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "File upload failed";
        addToast(msg, "error");
      }
    }
    e.target.value = "";
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    void sendPrivateImage(file);
  };

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
            ref={textareaRef}
            className="message-input"
            placeholder="Message..."
            autoComplete="off"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus
            aria-label="Type a direct message"
          />
          <div className="emoji-picker-wrapper" ref={emojiPickerRef}>
            <button
              type="button"
              className={`icon-btn emoji-toggle-btn${emojiOpen ? " active" : ""}`}
              title="Insert Emoji"
              aria-label="Insert emoji"
              onClick={() => setEmojiOpen((open) => !open)}
            >
              🙂
            </button>
            {emojiOpen && (
              <div className="emoji-picker" role="menu" aria-label="Emoji picker">
                <div className="emoji-grid">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-btn"
                      onClick={() => handleSelectEmoji(emoji)}
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
              onChange={handleAttach}
            />
          </label>
          <button
            type="button"
            className="icon-btn send-btn"
            onClick={handleSend}
            disabled={!canSend}
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
