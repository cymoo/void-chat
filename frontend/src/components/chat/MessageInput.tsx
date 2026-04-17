import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useChatStore, getMessageContent } from "@/stores/chatStore";
import { MessageInputBar } from "@/components/shared/MessageInputBar";
import { MentionDropdown } from "@/components/shared/MentionDropdown";
import type { MessageComposerReturn } from "@/hooks/useMessageComposer";
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

  // Composer ref to access setText/focus from parent
  const composerRef = useRef<MessageComposerReturn | null>(null);

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
          .filter((u) => u.id !== currentUser.id &&
            (u.username.toLowerCase().includes(query) ||
             (u.displayName && u.displayName.toLowerCase().includes(query))))
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

  // Populate edit text
  useEffect(() => {
    if (editingMessageId) {
      const msg = messages.find((m) => m.id === editingMessageId);
      if (msg) {
        composerRef.current?.setText(getMessageContent(msg));
        composerRef.current?.textareaRef.current?.focus();
      }
    }
  }, [editingMessageId, messages]);

  // Auto-focus input when replying
  useEffect(() => {
    if (replyingTo) {
      composerRef.current?.textareaRef.current?.focus();
    }
  }, [replyingTo]);

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

  const insertMention = useCallback(
    (username: string) => {
      const composer = composerRef.current;
      if (!composer) return;
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
    },
    [],
  );

  const onKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionResults.length);
          return true;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(mentionResults[mentionIndex]!.username);
          return true;
        }
        if (e.key === "Escape") {
          setMentionQuery(null);
          setMentionResults([]);
          return true;
        }
      }
      return false;
    },
    [mentionResults, mentionIndex, insertMention],
  );

  const cancelIndicator = useCallback(() => {
    setEditingMessage(null);
    setReplyingTo(null);
    composerRef.current?.setText("");
  }, [setEditingMessage, setReplyingTo]);

  const renderAbove = useCallback((composer: MessageComposerReturn) => (
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

      {/* Mention dropdown anchored to textarea */}
      <MentionDropdown
        results={mentionResults}
        selectedIndex={mentionIndex}
        onSelect={insertMention}
        anchorEl={composer.textareaRef.current}
      />
    </>
  ), [editingMessageId, replyingTo, mentionResults, mentionIndex, cancelIndicator, insertMention]);

  return (
    <MessageInputBar
      composerRef={composerRef}
      onSubmit={onSubmit}
      onImageUploaded={onImageUploaded}
      onFileUploaded={onFileUploaded}
      onTextChange={onTextChange}
      onKeyDownCapture={onKeyDownCapture}
      renderAbove={renderAbove}
      hintText="Enter send · Shift+Enter new line · @mention · Paste images"
    />
  );
}
