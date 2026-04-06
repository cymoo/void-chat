import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { useChatStore, getMessageContent } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import type { User, WsSendPayload } from "@/api/types";

interface MessageInputProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

export function MessageInput({ send, currentUser }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editingMessageId = useChatStore((s) => s.editingMessageId);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const messages = useChatStore((s) => s.messages);
  const users = useChatStore((s) => s.users);
  const addToast = useUiStore((s) => s.addToast);

  // Mention dropdown
  const [, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<typeof users>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Populate edit text
  useEffect(() => {
    if (editingMessageId) {
      const msg = messages.find((m) => m.id === editingMessageId);
      if (msg) {
        setText(getMessageContent(msg));
        textareaRef.current?.focus();
      }
    }
  }, [editingMessageId, messages]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Check for @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1]!.toLowerCase();
      setMentionQuery(query);
      const filtered = users
        .filter((u) => u.id !== currentUser.id && u.username.toLowerCase().includes(query))
        .slice(0, 5);
      setMentionResults(filtered);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  const insertMention = (username: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const newTextBefore = textBefore.replace(/@\w*$/, `@${username} `);
    setText(newTextBefore + textAfter);
    setMentionQuery(null);
    setMentionResults([]);
    el.focus();
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessageId) {
      send({ type: "edit", messageId: editingMessageId, content: trimmed });
      setEditingMessage(null);
    } else {
      const payload: WsSendPayload = { type: "text", content: trimmed };
      if (replyingTo) {
        payload.replyToId = replyingTo.id;
      }
      send(payload);
      setReplyingTo(null);
    }
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention navigation
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]!.username);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadImage(file);
      if (result.url) {
        send({
          type: "image",
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
    if (!file) return;
    try {
      const result = await api.uploadFile(file);
      if (result.url) {
        send({
          type: "file",
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

  const cancelIndicator = () => {
    setEditingMessage(null);
    setReplyingTo(null);
    setText("");
  };

  return (
    <>
      {/* Reply / Edit indicator */}
      {(editingMessageId || replyingTo) && (
        <div className="input-indicator">
          <span>
            {editingMessageId
              ? "Editing message..."
              : `Replying to ${replyingTo?.messageType !== "system" ? replyingTo?.username : ""}...`}
          </span>
          <button className="indicator-cancel" onClick={cancelIndicator}>
            ×
          </button>
        </div>
      )}

      {/* Mention dropdown */}
      {mentionResults.length > 0 && (
        <div className="mention-dropdown" style={{ display: "block" }}>
          {mentionResults.map((u, i) => (
            <div
              key={u.id}
              className={`mention-item${i === mentionIndex ? " selected" : ""}`}
              onClick={() => insertMention(u.username)}
            >
              <span className="mention-item-name">{u.username}</span>
              <span className="mention-item-username">@{u.username}</span>
            </div>
          ))}
        </div>
      )}

      <div className="input-panel">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="Type message... (Markdown supported)"
            autoComplete="off"
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <div className="input-actions">
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
            <button className="icon-btn send-btn" onClick={handleSend}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
        <div className="input-hint">
          Press <kbd>Enter</kbd> to send • <kbd>Shift+Enter</kbd> for new line • Supports <strong>Markdown</strong> and <code>code</code> • Use @username to mention
        </div>
      </div>
    </>
  );
}
