import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { onMessageJump } from "@/lib/messageJump";
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
  const users = useChatStore((s) => s.users);
  const showUserCard = useUiStore((s) => s.showUserCard);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadingRef = useRef(false);
  const scrollingRef = useRef(false);
  const pendingJumpIdRef = useRef<number | null>(null);
  const jumpLoadRequestedRef = useRef(false);

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
    if (pendingJumpIdRef.current === null && isAtBottomRef.current) {
      syncToBottom();
    }
  }, [messages, syncToBottom]);

  const clearHighlightTimerRef = useRef<number | null>(null);

  const centerMessageInView = useCallback((target: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top;
    const centeredTop = container.scrollTop + offset - (container.clientHeight - target.clientHeight) / 2;
    container.scrollTo({ top: centeredTop, behavior: "smooth" });
  }, []);

  const highlightMessage = useCallback((target: HTMLElement) => {
    target.classList.remove("message-highlight");
    // Force reflow so repeated jumps retrigger highlight animation.
    void target.getBoundingClientRect();
    target.classList.add("message-highlight");
    if (clearHighlightTimerRef.current !== null) {
      window.clearTimeout(clearHighlightTimerRef.current);
    }
    clearHighlightTimerRef.current = window.setTimeout(() => {
      target.classList.remove("message-highlight");
      clearHighlightTimerRef.current = null;
    }, 1600);
  }, []);

  const tryJumpToMessage = useCallback((messageId: number) => {
    const container = containerRef.current;
    if (!container) return true;

    const target = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (target) {
      centerMessageInView(target);
      highlightMessage(target);
      pendingJumpIdRef.current = null;
      return true;
    }

    const shouldLoadMore =
      hasMore &&
      oldestMessageId !== null &&
      messageId < oldestMessageId &&
      !loadingRef.current;
    if (shouldLoadMore) {
      loadingRef.current = true;
      jumpLoadRequestedRef.current = true;
      send({ type: "load_history", beforeId: oldestMessageId });
      return false;
    }

    pendingJumpIdRef.current = null;
    return true;
  }, [centerMessageInView, hasMore, highlightMessage, oldestMessageId, send]);

  useEffect(() => {
    return onMessageJump((messageId) => {
      pendingJumpIdRef.current = messageId;
      isAtBottomRef.current = false;
      tryJumpToMessage(messageId);
    });
  }, [tryJumpToMessage]);

  useEffect(() => {
    if (jumpLoadRequestedRef.current) {
      loadingRef.current = false;
      jumpLoadRequestedRef.current = false;
    }
    const pendingId = pendingJumpIdRef.current;
    if (pendingId !== null) {
      tryJumpToMessage(pendingId);
    }
  }, [messages, tryJumpToMessage]);

  useEffect(
    () => () => {
      if (clearHighlightTimerRef.current !== null) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
    },
    [],
  );

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

  // Mention click delegation: resolve @username → userId, open profile card
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-mention-user]");
      if (!target) return;
      const mentionUsername = target.getAttribute("data-mention-user");
      if (!mentionUsername) return;
      const user = users.find(
        (u) => u.username.toLowerCase() === mentionUsername.toLowerCase(),
      );
      if (user) {
        showUserCard(user.id);
      }
    },
    [users, showUserCard],
  );

  return (
    <div
      ref={containerRef}
      className="messages-container"
      onScroll={handleScroll}
      onClick={handleContainerClick}
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
