import {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
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
        <div className="private-msg-author">{message.senderUsername}</div>
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
        <div className="private-msg-time">{formatTime(message.timestamp)}</div>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);
  const setImageModal = useUiStore((s) => s.setImageModal);
  const addToast = useUiStore((s) => s.addToast);
  const canSend = text.trim().length > 0;
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

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !privateChatUserId) return;
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
    e.target.value = "";
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !privateChatUserId) return;
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
      const msg = err instanceof Error ? err.message : "文件上传失败";
      addToast(msg, "error");
    }
    e.target.value = "";
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={closePrivateChat} />
      <div className="private-chat-panel">
        <div className="private-chat-header">
          <span>DM: {privateChatUsername}</span>
          <button className="modal-close panel-close-btn" onClick={closePrivateChat}>
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
            autoFocus
            aria-label="Type a direct message"
          />
          <label className="icon-btn" title="Upload Image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageUpload}
            />
          </label>
          <label className="icon-btn" title="Upload File">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFileUpload}
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
          <kbd>Enter</kbd> send • <kbd>Shift+Enter</kbd> new line
        </div>
      </div>
    </div>
  );
}
