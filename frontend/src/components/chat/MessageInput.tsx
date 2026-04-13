import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useChatStore, getMessageContent } from "@/stores/chatStore";
import { COMMON_EMOJIS } from "@/lib/emojis";
import { useMessageComposer } from "@/hooks/useMessageComposer";
import type { User, WsSendPayload } from "@/api/types";

interface MessageInputProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

export function MessageInput({ send, currentUser }: MessageInputProps) {
  const editingMessageId = useChatStore((s) => s.editingMessageId);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const messages = useChatStore((s) => s.messages);
  const users = useChatStore((s) => s.users);

  // Typing indicator refs
  const typingTimerRef = useRef<number | null>(null);
  const typingStateRef = useRef(false);

  // Mention dropdown state
  const [, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<typeof users>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (typingStateRef.current === isTyping) return;
      typingStateRef.current = isTyping;
      send({ type: "typing", isTyping });
    },
    [send],
  );

  const scheduleStopTyping = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(false);
      typingTimerRef.current = null;
    }, 1500);
  }, [sendTyping]);

  // Stable ref for replyingTo so the onSubmit/onImageUploaded closures read the latest value
  const replyingToRef = useRef(replyingTo);
  replyingToRef.current = replyingTo;

  const onSubmit = useCallback(
    (text: string) => {
      if (editingMessageId) {
        send({ type: "edit", messageId: editingMessageId, content: text });
        setEditingMessage(null);
      } else {
        const payload: WsSendPayload = { type: "text", content: text };
        if (replyingToRef.current) {
          payload.replyToId = replyingToRef.current.id;
        }
        send(payload);
        setReplyingTo(null);
      }
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      sendTyping(false);
    },
    [editingMessageId, send, sendTyping, setEditingMessage, setReplyingTo],
  );

  const onImageUploaded = useCallback(
    (url: string, thumbnailUrl?: string) => {
      const payload: WsSendPayload = { type: "image", imageUrl: url, thumbnailUrl };
      if (replyingToRef.current) {
        payload.replyToId = replyingToRef.current.id;
      }
      send(payload);
      if (replyingToRef.current) {
        setReplyingTo(null);
      }
    },
    [send, setReplyingTo],
  );

  const onFileUploaded = useCallback(
    (fileName: string, fileUrl: string, fileSize: number, mimeType: string) => {
      const payload: WsSendPayload = { type: "file", fileName, fileUrl, fileSize, mimeType };
      if (replyingToRef.current) {
        payload.replyToId = replyingToRef.current.id;
      }
      send(payload);
      if (replyingToRef.current) {
        setReplyingTo(null);
      }
    },
    [send, setReplyingTo],
  );

  const onTextChange = useCallback(
    (val: string, textarea: HTMLTextAreaElement | null) => {
      // Typing indicator
      if (val.trim().length > 0) {
        sendTyping(true);
        scheduleStopTyping();
      } else {
        if (typingTimerRef.current !== null) {
          window.clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        sendTyping(false);
      }

      // Mention detection
      const cursorPos = textarea?.selectionStart ?? val.length;
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
    },
    [currentUser.id, scheduleStopTyping, sendTyping, users],
  );

  const composer = useMessageComposer({
    onSubmit,
    onImageUploaded,
    onFileUploaded,
    onTextChange,
  });

  // Populate edit text
  useEffect(() => {
    if (editingMessageId) {
      const msg = messages.find((m) => m.id === editingMessageId);
      if (msg) {
        composer.setText(getMessageContent(msg));
        composer.textareaRef.current?.focus();
      }
    }
  }, [editingMessageId, messages, composer]);

  // Cleanup typing on unmount
  useEffect(
    () => () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
      }
      sendTyping(false);
    },
    [sendTyping],
  );

  const insertMention = (username: string) => {
    const el = composer.textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const textBefore = composer.text.slice(0, cursorPos);
    const textAfter = composer.text.slice(cursorPos);
    const newTextBefore = textBefore.replace(/@\w*$/, `@${username} `);
    composer.setText(newTextBefore + textAfter);
    setMentionQuery(null);
    setMentionResults([]);
    el.focus();
  };

  // Wrap the base handleKeyDown to intercept mention navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    composer.handleKeyDown(e);
  };

  const cancelIndicator = () => {
    setEditingMessage(null);
    setReplyingTo(null);
    composer.setText("");
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
            ref={composer.textareaRef}
            className="message-input"
            placeholder="Message..."
            autoComplete="off"
            rows={1}
            value={composer.text}
            onChange={composer.handleChange}
            onKeyDown={handleKeyDown}
            onPaste={composer.handlePaste}
            onBlur={() => sendTyping(false)}
          />
          <div className="input-actions">
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
          </div>
          <button
            type="button"
            className="icon-btn send-btn"
            onClick={composer.handleSend}
            disabled={!composer.canSend}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="input-hint">
          <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> new line · @mention · Paste images
        </div>
      </div>
    </>
  );
}
