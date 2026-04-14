import { useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useChatStore, getOldestMessageId } from "@/stores/chatStore";
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
  const oldestMessageId = getOldestMessageId(messages);
  const users = useChatStore((s) => s.users);
  const showUserCard = useUiStore((s) => s.showUserCard);
  const parentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadingRef = useRef(false);
  const pendingJumpIdRef = useRef<number | null>(null);
  const jumpLoadRequestedRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  // Build message-id → index lookup for jump-to-message
  const messageIndexMap = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < messages.length; i++) {
      map.set(messages[i]!.id, i);
    }
    messageIndexMap.current = map;
  }, [messages]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    // Double-RAF to ensure measurement settles before final scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
      });
    });
  }, [messages.length, virtualizer]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (pendingJumpIdRef.current !== null) return;
    if (isAtBottomRef.current && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Preserve scroll position when history is prepended
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;
    if (prevCount > 0 && currentCount > prevCount && !isAtBottomRef.current) {
      const prepended = currentCount - prevCount;
      // If the first message changed, history was prepended — shift scroll offset
      if (prepended > 0 && pendingJumpIdRef.current === null) {
        const el = parentRef.current;
        if (el) {
          // Use scrollToIndex to maintain the same visual position
          virtualizer.scrollToIndex(prepended, { align: "start" });
        }
      }
    }
    prevMessageCountRef.current = currentCount;
  }, [messages, virtualizer]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Track scroll position for auto-scroll and history loading
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;

    const threshold = 100;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    // Load more history when scrolled near top
    if (
      el.scrollTop < 200 &&
      hasMore &&
      !loadingRef.current &&
      oldestMessageId
    ) {
      loadingRef.current = true;
      send({ type: "load_history", beforeId: oldestMessageId });
    }
  }, [hasMore, oldestMessageId, send]);

  // Reset loading flag when messages change (history arrived)
  useEffect(() => {
    if (loadingRef.current) {
      loadingRef.current = false;
    }
  }, [messages]);

  // --- Jump-to-message ---
  const clearHighlightTimerRef = useRef<number | null>(null);

  const highlightMessage = useCallback((target: HTMLElement) => {
    target.classList.remove("message-highlight");
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

  const tryJumpToMessage = useCallback(
    (messageId: number) => {
      const index = messageIndexMap.current.get(messageId);
      if (index !== undefined) {
        // Scroll to the target index, then highlight once rendered
        virtualizer.scrollToIndex(index, { align: "center" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const container = parentRef.current;
            if (!container) return;
            const target = container.querySelector<HTMLElement>(
              `[data-message-id="${messageId}"]`,
            );
            if (target) {
              highlightMessage(target);
            }
          });
        });
        pendingJumpIdRef.current = null;
        return true;
      }

      // Message not in array yet — load more history if possible
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
    },
    [hasMore, highlightMessage, oldestMessageId, send, virtualizer],
  );

  useEffect(() => {
    return onMessageJump((messageId) => {
      pendingJumpIdRef.current = messageId;
      isAtBottomRef.current = false;
      tryJumpToMessage(messageId);
    });
  }, [tryJumpToMessage]);

  // Retry jump after history loads
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

  // Re-measure virtualizer when media (images) load
  const handleMediaLoad = useCallback(() => {
    virtualizer.measure();
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [virtualizer, scrollToBottom]);

  // Mention click delegation
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-mention-user]",
      );
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

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="messages-container"
      onScroll={handleScroll}
      onClick={handleContainerClick}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {hasMore && (
          <div className="history-loader">
            <span className="loader-text">Loading history...</span>
          </div>
        )}
        {virtualItems.map((virtualRow) => {
          const msg = messages[virtualRow.index]!;
          return (
            <div
              key={msg.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageItem
                message={msg}
                currentUserId={currentUser.id}
                currentUsername={currentUser.username}
                send={send}
                onMediaLoad={handleMediaLoad}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
