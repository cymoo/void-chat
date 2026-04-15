import { useEffect, useRef, useCallback, useState, memo } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useChatStore, getOldestMessageId } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { onMessageJump } from "@/lib/messageJump";
import { MessageItem } from "./MessageItem";
import type { ChatMessage, User, WsSendPayload } from "@/api/types";

// Large starting index so prepending history never goes below 0
const START_INDEX = 100_000;

interface MessageListProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

// Stable Header component — only renders the loading indicator
const Header = memo(
  ({ context }: { context?: { hasMore: boolean } }) =>
    context?.hasMore ? (
      <div className="history-loader">
        <span className="loader-text">Loading history...</span>
      </div>
    ) : null,
);
Header.displayName = "VirtuosoHeader";

export function MessageList({ send, currentUser }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const hasMore = useChatStore((s) => s.hasMore);
  const initialLoaded = useChatStore((s) => s.initialLoaded);
  const oldestMessageId = getOldestMessageId(messages);
  const users = useChatStore((s) => s.users);
  const showUserCard = useUiStore((s) => s.showUserCard);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);
  const loadingRef = useRef(false);
  const pendingJumpIdRef = useRef<number | null>(null);
  const jumpLoadRequestedRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // firstItemIndex shifts down each time history is prepended so Virtuoso
  // can preserve scroll position without any manual offset calculation.
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const prevFirstMsgIdRef = useRef<number | null>(null);
  const lastKnownMsgIdRef = useRef<number | null>(null);

  // Build message-id → array-index lookup for jump-to-message
  const messageIndexMap = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < messages.length; i++) {
      map.set(messages[i]!.id, i);
    }
    messageIndexMap.current = map;
  }, [messages]);

  // When history is prepended, decrease firstItemIndex by the actual prepend count
  // so existing items keep their virtual index and scroll position is preserved.
  useEffect(() => {
    const currentFirstId = messages.length > 0 ? messages[0]!.id : null;
    const prevFirstId = prevFirstMsgIdRef.current;
    prevFirstMsgIdRef.current = currentFirstId;

    if (
      prevFirstId !== null &&
      currentFirstId !== null &&
      currentFirstId !== prevFirstId
    ) {
      // Find where the old first message now sits to count actual prepends
      let prependCount = 0;
      for (let i = 0; i < messages.length; i++) {
        if (messages[i]!.id === prevFirstId) {
          prependCount = i;
          break;
        }
      }
      if (prependCount > 0 && !isAtBottomRef.current) {
        setFirstItemIndex((idx) => idx - prependCount);
      }
      loadingRef.current = false;
    }
  }, [messages]);

  // Unread counter: only count genuinely new (appended) messages by tracking IDs
  useEffect(() => {
    if (pendingJumpIdRef.current !== null) return;
    if (messages.length === 0) return;

    const currentLastId = messages[messages.length - 1]!.id;
    const prevLastId = lastKnownMsgIdRef.current;
    lastKnownMsgIdRef.current = currentLastId;

    // Initial load or no new messages appended at the end
    if (prevLastId === null || currentLastId <= prevLastId) return;

    // Collect genuinely new messages (appended after prevLastId)
    const newMessages: ChatMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.id <= prevLastId) break;
      newMessages.unshift(messages[i]!);
    }
    if (newMessages.length === 0) return;

    const ownNew = newMessages.filter(
      (m) => "userId" in m && m.userId === currentUser.id,
    );
    const othersNew = newMessages.filter(
      (m) => !("userId" in m) || m.userId !== currentUser.id,
    );

    if (!isAtBottomRef.current) {
      // Auto-scroll for own sent messages regardless of scroll position
      if (ownNew.length > 0) {
        isAtBottomRef.current = true;
        setUnreadCount(0);
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "auto" });
        });
      }
      // Only count others' messages as unread
      if (othersNew.length > 0) {
        setUnreadCount((c) => c + othersNew.length);
      }
    }
  }, [messages, currentUser.id]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "auto" });
  }, []);

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
        // Use "auto" (instant) so the item is in DOM before we try to highlight
        virtuosoRef.current?.scrollToIndex({ index, align: "center", behavior: "auto" });
        setTimeout(() => {
          const target = document.querySelector<HTMLElement>(
            `[data-message-id="${messageId}"]`,
          );
          if (target) highlightMessage(target);
        }, 80);
        pendingJumpIdRef.current = null;
        return true;
      }

      // Message not loaded yet — request more history
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
    [hasMore, highlightMessage, oldestMessageId, send],
  );

  useEffect(() => {
    return onMessageJump((messageId) => {
      pendingJumpIdRef.current = messageId;
      isAtBottomRef.current = false;
      tryJumpToMessage(messageId);
    });
  }, [tryJumpToMessage]);

  // Retry jump after each history batch arrives
  useEffect(() => {
    if (jumpLoadRequestedRef.current) {
      jumpLoadRequestedRef.current = false;
    }
    const pendingId = pendingJumpIdRef.current;
    if (pendingId !== null) tryJumpToMessage(pendingId);
  }, [messages, tryJumpToMessage]);

  useEffect(
    () => () => {
      if (clearHighlightTimerRef.current !== null) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
    },
    [],
  );

  // Mention click delegation — single listener on the wrapper
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
      if (user) showUserCard(user.id);
    },
    [users, showUserCard],
  );

  const handleMediaLoad = useCallback(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [scrollToBottom]);

  const context = { hasMore };

  if (!initialLoaded) {
    return (
      <div className="messages-wrapper">
        <div className="messages-container messages-loading">
          <div className="matrix-loader">
            <span className="matrix-loader-text" data-text="DECRYPTING CHANNEL">DECRYPTING CHANNEL</span>
            <div className="matrix-loader-bar"><div className="matrix-loader-fill" /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-wrapper" onClick={handleContainerClick}>
      <Virtuoso
        ref={virtuosoRef}
        className="messages-container"
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        followOutput={(isAtBottom) => (isAtBottom ? "auto" : false)}
        atBottomStateChange={(atBottom) => {
          isAtBottomRef.current = atBottom;
          if (atBottom) setUnreadCount(0);
        }}
        atBottomThreshold={50}
        startReached={() => {
          if (hasMore && !loadingRef.current && oldestMessageId) {
            loadingRef.current = true;
            send({ type: "load_history", beforeId: oldestMessageId });
          }
        }}
        context={context}
        components={{ Header }}
        itemContent={(_index, msg) => (
          <MessageItem
            message={msg}
            currentUserId={currentUser.id}
            currentUsername={currentUser.username}
            send={send}
            onMediaLoad={handleMediaLoad}
          />
        )}
      />
      {unreadCount > 0 && (
        <button
          className="new-messages-btn"
          onClick={() => {
            setUnreadCount(0);
            isAtBottomRef.current = true;
            scrollToBottom();
          }}
        >
          ▼ {unreadCount} new message{unreadCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
