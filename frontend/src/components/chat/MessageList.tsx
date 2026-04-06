import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { MessageItem } from "./MessageItem";
import type { User, WsSendPayload } from "@/api/types";

interface MessageListProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

export function MessageList({ send, currentUser }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const hasMore = useChatStore((s) => s.hasMore);
  const oldestMessageId = useChatStore((s) => s.oldestMessageId);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadingRef = useRef(false);
  const scrollingRef = useRef(false);

  const syncToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottomRef.current) {
      syncToBottom();
    }
  }, [messages, syncToBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollingRef.current) return;
    scrollingRef.current = true;

    requestAnimationFrame(() => {
      const threshold = 100;
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

      // Load more history when scrolled to top
      if (el.scrollTop < 50 && hasMore && !loadingRef.current && oldestMessageId) {
        loadingRef.current = true;
        const prevHeight = el.scrollHeight;
        send({ type: "load_history", beforeId: oldestMessageId });
        // Restore scroll position after history loads
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const newHeight = el.scrollHeight;
            el.scrollTop = newHeight - prevHeight;
            loadingRef.current = false;
          });
        });
      }

      scrollingRef.current = false;
    });
  }, [hasMore, oldestMessageId, send]);

  // Initial scroll to bottom
  useEffect(() => {
    syncToBottom();
  }, [syncToBottom]);

  const handleMediaLoad = useCallback(() => {
    if (isAtBottomRef.current) {
      syncToBottom();
    }
  }, [syncToBottom]);

  return (
    <div
      ref={containerRef}
      className="messages-container"
      onScroll={handleScroll}
    >
      {hasMore && (
        <div className="history-loader">
          <span className="loader-text">Loading history...</span>
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          currentUser={currentUser}
          send={send}
          onMediaLoad={handleMediaLoad}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
