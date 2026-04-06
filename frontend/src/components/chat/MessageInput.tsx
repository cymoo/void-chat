import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import type { WsSendPayload } from "@/api/types";
import { useChatStore, getMessageContent } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";

interface MessageInputProps {
  send: (payload: WsSendPayload) => void;
  userId: number;
  username: string;
}

export function MessageInput({ send, userId, username }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editingMessageId = useChatStore((s) => s.editingMessageId);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const messages = useChatStore((s) => s.messages);
  const users = useChatStore((s) => s.users);
  const addToast = useUiStore((s) => s.addToast);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<
    Array<{ id: number; username: string }>
  >([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Populate edit field when editing
  useEffect(() => {
    if (editingMessageId !== null) {
      const msg = messages.find((m) => m.id === editingMessageId);
      if (msg) {
        setText(getMessageContent(msg));
        textareaRef.current?.focus();
      }
    }
  }, [editingMessageId, messages]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessageId !== null) {
      send({ type: "edit", messageId: editingMessageId, content: trimmed });
      setEditingMessage(null);
    } else {
      send({
        type: "text",
        content: trimmed,
        replyToId: replyingTo?.id,
      });
      setReplyingTo(null);
    }
    setText("");
  }, [text, editingMessageId, replyingTo, send, setEditingMessage, setReplyingTo]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (mentionQuery !== null && mentionResults.length > 0) {
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
        const selected = mentionResults[mentionIndex];
        if (selected) {
          insertMention(selected.username);
        }
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === "Escape" && editingMessageId !== null) {
      setEditingMessage(null);
      setText("");
    }
  };

  const insertMention = (uname: string) => {
    if (mentionQuery === null) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const pos = ta.selectionStart;
    const before = text.substring(0, pos);
    const after = text.substring(pos);
    const atIndex = before.lastIndexOf("@");
    const newText = before.substring(0, atIndex) + `@${uname} ` + after;
    setText(newText);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      const newPos = atIndex + uname.length + 2;
      ta.setSelectionRange(newPos, newPos);
      ta.focus();
    });
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Check for @mention
    const pos = e.target.selectionStart;
    const beforeCursor = val.substring(0, pos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1]!.toLowerCase();
      setMentionQuery(query);
      const results = users
        .filter((u) => u.id !== userId && u.username.toLowerCase().includes(query))
        .slice(0, 5);
      setMentionResults(results);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadImage(file);
      if (result.success && result.url) {
        send({
          type: "image",
          imageUrl: result.url,
          thumbnailUrl: result.thumbnail ?? undefined,
          replyToId: replyingTo?.id,
        });
        setReplyingTo(null);
      } else {
        addToast(result.error ?? "Upload failed", "error");
      }
    } catch {
      addToast("Upload failed", "error");
    }
    e.target.value = "";
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file);
      if (result.success && result.url) {
        send({
          type: "file",
          fileName: result.fileName ?? file.name,
          fileUrl: result.url,
          fileSize: result.fileSize ?? file.size,
          mimeType: file.type || "application/octet-stream",
          replyToId: replyingTo?.id,
        });
        setReplyingTo(null);
      } else {
        addToast(result.error ?? "Upload failed", "error");
      }
    } catch {
      addToast("Upload failed", "error");
    }
    e.target.value = "";
  };

  // Handle paste for image upload
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            try {
              const result = await api.uploadImage(file);
              if (result.success && result.url) {
                send({ type: "image", imageUrl: result.url, thumbnailUrl: result.thumbnail ?? undefined });
              }
            } catch {
              addToast("Paste upload failed", "error");
            }
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [send, addToast]);

  return (
    <div className="border-t border-terminal-border bg-terminal-surface shrink-0">
      {/* Reply / Edit indicator */}
      {(replyingTo || editingMessageId !== null) && (
        <div className="flex items-center justify-between px-4 py-1 bg-terminal-surface-2 text-xs border-b border-terminal-border">
          <span>
            {editingMessageId !== null ? (
              <span className="text-terminal-amber">✎ Editing message...</span>
            ) : (
              <span className="text-terminal-cyan">
                ↩ Replying to @
                {"username" in replyingTo! ? replyingTo!.username : "user"}
              </span>
            )}
          </span>
          <button
            onClick={() => {
              setEditingMessage(null);
              setReplyingTo(null);
              setText("");
            }}
            className="text-terminal-text-dim hover:text-terminal-red"
          >
            ×
          </button>
        </div>
      )}

      {/* Mention dropdown */}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="border-b border-terminal-border bg-terminal-surface-2">
          {mentionResults.map((u, i) => (
            <button
              key={u.id}
              onClick={() => insertMention(u.username)}
              className={`block w-full text-left px-4 py-1 text-sm ${
                i === mentionIndex
                  ? "bg-terminal-green/20 text-terminal-green"
                  : "text-terminal-text hover:bg-terminal-surface"
              }`}
            >
              @{u.username}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 py-2">
        <span className="text-terminal-green shrink-0 pb-1">
          {username}@chat $
        </span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          className="flex-1 bg-transparent text-terminal-text font-mono text-sm resize-none focus:outline-none min-h-[24px] max-h-32"
          placeholder="type a message..."
          style={{
            height: "auto",
            overflow: "hidden",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
        <div className="flex items-center gap-1 shrink-0 pb-1">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="text-terminal-text-dim hover:text-terminal-green text-sm px-1"
            title="Upload image"
          >
            🖼
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-terminal-text-dim hover:text-terminal-green text-sm px-1"
            title="Upload file"
          >
            📎
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
