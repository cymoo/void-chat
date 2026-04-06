import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { MessageItem } from "./MessageItem";
import type { WsSendPayload } from "@/api/types";

interface MessageListProps {
  send: (payload: WsSendPayload) => void;
  userId: number;
}

export function MessageList({ send, userId }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const hasMore = useChatStore((s) => s.hasMore);
  const oldestMessageId = useChatStore((s) => s.oldestMessageId);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Track if user has scrolled up
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    shouldAutoScrollRef.current = isAtBottom;

    // Load older messages when scrolling to top
    if (el.scrollTop < 50 && hasMore && !loadingRef.current && oldestMessageId) {
      loadingRef.current = true;
      const prevHeight = el.scrollHeight;
      send({ type: "load_history", beforeId: oldestMessageId });

      // Restore scroll position after prepend
      requestAnimationFrame(() => {
        const newHeight = el.scrollHeight;
        el.scrollTop = newHeight - prevHeight;
        loadingRef.current = false;
      });
    }
  }, [hasMore, oldestMessageId, send]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2"
    >
      {hasMore && (
        <div className="text-center text-terminal-text-dim text-xs py-2">
          ↑ scroll up to load older messages
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-terminal-text-dim">
          <div className="text-center">
            <div className="text-2xl mb-2">◇</div>
            <div className="text-sm">No messages yet. Start the conversation.</div>
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            isOwn={"userId" in msg && msg.userId === userId}
            send={send}
          />
        ))
      )}

      <div ref={bottomRef} />
    </div>
  );
}
