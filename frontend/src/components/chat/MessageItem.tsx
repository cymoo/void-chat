import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { renderMarkdown, highlightMentions } from "@/lib/markdown";
import { requestMessageJump } from "@/lib/messageJump";
import { formatTime, formatRelativeTime, getInitials } from "@/lib/utils";
import { useCurrentMinute } from "@/hooks/useCurrentTime";
import { MessageContent } from "@/components/chat/MessageContent";
import { openImageGallery } from "@/components/ui/ImageViewer";
import type { ChatMessage, WsSendPayload } from "@/api/types";

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: number;
  currentUsername: string;
  send: (payload: WsSendPayload) => void;
  onMediaLoad?: () => void;
}

function MessageItemInner({
  message,
  currentUserId,
  currentUsername,
  send,
  onMediaLoad,
}: MessageItemProps) {
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const users = useChatStore((s) => s.users);
  const confirm = useUiStore((s) => s.confirm);
  const showUserCard = useUiStore((s) => s.showUserCard);
  const currentDisplayName = useAuthStore((s) => s.user?.displayName);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile actions menu on outside click
  useEffect(() => {
    if (!mobileActionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileActionsOpen]);

  // Re-render every minute so relative timestamps stay current
  useCurrentMinute();

  const isOwn = message.messageType !== "system" && message.userId === currentUserId;

  // Resolve bot info from user list
  const botUser = message.messageType !== "system"
    ? users.find((u) => u.id === message.userId && u.isBot)
    : undefined;
  const displayName = botUser?.displayName ?? (message.messageType !== "system" ? message.username : "");

  const EDIT_WINDOW_MS = 5 * 60 * 1000;
  const withinEditWindow =
    isOwn && Date.now() - message.timestamp < EDIT_WINDOW_MS;

  const hasActions = message.messageType !== "system";

  const handleDelete = useCallback(async () => {
    setMobileActionsOpen(false);
    const confirmed = await confirm({
      title: "DELETE MESSAGE",
      message: "Delete this message?",
      confirmText: "DELETE",
      cancelText: "CANCEL",
      tone: "danger",
    });
    if (confirmed) {
      send({ type: "delete", messageId: message.id });
    }
  }, [confirm, message.id, send]);

  const handleReplyClick = useCallback(() => {
    if (message.replyTo) {
      requestMessageJump(message.replyTo.id);
    }
  }, [message.replyTo]);

  const textHtml = useMemo(() => {
    if (message.messageType !== "text") return null;
    return highlightMentions(renderMarkdown(message.content), currentUsername, currentDisplayName ?? undefined);
  }, [message, currentUsername, currentDisplayName]);

  if (message.messageType === "system") {
    return (
      <div className="message system" data-message-id={message.id}>
        <div className="message-content">
          <div className="message-text">{message.content}</div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (message.messageType === "text") {
      return (
        <MessageContent
          type="text"
          contentHtml={textHtml ?? ""}
          editedAt={message.editedAt}
        />
      );
    }

    if (message.messageType === "image") {
      const handleImageClick = () => {
        const allMessages = useChatStore.getState().messages;
        const imageMessages = allMessages.filter((m) => m.messageType === "image");
        const items = imageMessages.map((m) => ({
          src: (m as { imageUrl: string }).imageUrl,
          width: (m as { width?: number | null }).width ?? undefined,
          height: (m as { height?: number | null }).height ?? undefined,
        }));
        const clickedIndex = imageMessages.findIndex((m) => m.id === message.id);
        openImageGallery(items, Math.max(0, clickedIndex));
      };
      return (
        <MessageContent
          type="image"
          imageUrl={message.imageUrl}
          width={message.width}
          height={message.height}
          onImageClick={handleImageClick}
          onMediaLoad={onMediaLoad}
        />
      );
    }

    if (message.messageType === "file") {
      return (
        <MessageContent
          type="file"
          fileName={message.fileName}
          fileUrl={message.fileUrl}
          fileSize={message.fileSize}
        />
      );
    }

    return null;
  };

  const actionButtons = (
    <>
      <button
        className="msg-action-btn msg-action-reply"
        onClick={() => { setReplyingTo(message); setMobileActionsOpen(false); }}
        title="Reply"
        aria-label="Reply to message"
      >
        ↩
      </button>
      {withinEditWindow && message.messageType === "text" && (
        <button
          className="msg-action-btn msg-action-edit"
          onClick={() => { setEditingMessage(message.id); setMobileActionsOpen(false); }}
          title="Edit"
          aria-label="Edit message"
        >
          ✎
        </button>
      )}
      {withinEditWindow && (
        <button
          className="msg-action-btn msg-action-delete"
          onClick={handleDelete}
          title="Delete"
          aria-label="Delete message"
        >
          ✕
        </button>
      )}
    </>
  );

  return (
    <div className={`message${isOwn ? " message-self" : ""}${botUser ? " message-bot" : ""}`} data-message-id={message.id}>
      <div
        className="message-avatar"
        onClick={() => showUserCard(message.userId)}
      >
        {botUser?.avatarUrl ?? message.avatarUrl ? (
          <img
            src={(botUser?.avatarUrl ?? message.avatarUrl)!}
            alt={displayName}
            loading="lazy"
            className="avatar-img"
          />
        ) : botUser ? (
          <span className="bot-avatar-icon">🤖</span>
        ) : (
          getInitials(message.username)
        )}
      </div>
      <div className="message-content">
        {message.replyTo && (
          <div className="reply-preview" onClick={handleReplyClick}>
            <span className="reply-author">↩ {message.replyTo.username}</span>
            <span className="reply-content">{message.replyTo.content}</span>
          </div>
        )}
        <div className="message-header">
          <div className="message-author">
            {displayName}
          </div>
          <div className="message-time" title={formatTime(message.timestamp)}>
            {formatRelativeTime(message.timestamp)}
          </div>
          {/* Desktop: hover-visible actions */}
          {hasActions && (
            <div className="message-actions message-actions-desktop">
              {actionButtons}
            </div>
          )}
          {/* Mobile: "more" toggle button */}
          {hasActions && (
            <div className="message-actions-mobile" ref={mobileMenuRef}>
              <button
                className="msg-more-btn"
                onClick={() => setMobileActionsOpen((o) => !o)}
                aria-label="Message actions"
              >
                ⋯
              </button>
              {mobileActionsOpen && (
                <div className="mobile-actions-menu">
                  {actionButtons}
                </div>
              )}
            </div>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);
