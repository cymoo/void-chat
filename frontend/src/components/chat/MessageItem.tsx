import { memo, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { renderMarkdown, highlightMentions } from "@/lib/markdown";
import { requestMessageJump } from "@/lib/messageJump";
import { formatTime, formatFileSize, getInitials } from "@/lib/utils";
import type { ChatMessage, User, WsSendPayload } from "@/api/types";

interface MessageItemProps {
  message: ChatMessage;
  currentUser: User;
  send: (payload: WsSendPayload) => void;
  onMediaLoad?: () => void;
}

function MessageItemInner({
  message,
  currentUser,
  send,
  onMediaLoad,
}: MessageItemProps) {
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const confirm = useUiStore((s) => s.confirm);
  const showUserCard = useUiStore((s) => s.showUserCard);
  const setImageModal = useUiStore((s) => s.setImageModal);

  if (message.messageType === "system") {
    return (
      <div className="message system" data-message-id={message.id}>
        <div className="message-content">
          <div className="message-text">{message.content}</div>
        </div>
      </div>
    );
  }

  const isOwn = message.userId === currentUser.id;

  const handleDelete = useCallback(async () => {
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
    return highlightMentions(renderMarkdown(message.content), currentUser.username);
  }, [message, currentUser.username]);

  const renderContent = () => {
    if (message.messageType === "text") {
      return (
        <>
          <div
            className="message-text markdown-body"
            dangerouslySetInnerHTML={{ __html: textHtml ?? "" }}
          />
          {message.editedAt && <span className="edited-tag">(edited)</span>}
        </>
      );
    }

    if (message.messageType === "image") {
      return (
        <>
          <div className="message-text">shared an image</div>
            <img
              src={message.imageUrl}
              className="message-image"
              onClick={() => setImageModal(message.imageUrl)}
              onLoad={onMediaLoad}
              alt="Shared image"
            />
        </>
      );
    }

    if (message.messageType === "file") {
      return (
        <>
          <div className="message-text">shared a file</div>
          <div className="message-file">
            <div className="file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>
            <div className="file-info">
              <div className="file-name">{message.fileName}</div>
              <div className="file-size">{formatFileSize(message.fileSize)}</div>
            </div>
            <a href={message.fileUrl} download className="file-download">
              DOWNLOAD
            </a>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="message" data-message-id={message.id}>
      <div
        className="message-avatar"
        style={{ cursor: "pointer" }}
        onClick={() => showUserCard(message.userId)}
      >
        {message.avatarUrl ? (
          <img
            src={message.avatarUrl}
            alt={message.username}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "2px" }}
          />
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
          <div className="message-author">{message.username}</div>
          <div className="message-time">{formatTime(message.timestamp)}</div>
          <div className="message-actions">
            <button
              className="msg-action-btn msg-action-reply"
              onClick={() => setReplyingTo(message)}
              title="Reply"
            >
              ↩
            </button>
            {isOwn && message.messageType === "text" && (
              <button
                className="msg-action-btn msg-action-edit"
                onClick={() => setEditingMessage(message.id)}
                title="Edit"
              >
                ✎
              </button>
            )}
            {isOwn && (
              <button
                className="msg-action-btn msg-action-delete"
                onClick={handleDelete}
                title="Delete"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export const MessageItem = memo(
  MessageItemInner,
  (prev, next) =>
    prev.message === next.message &&
    prev.currentUser.id === next.currentUser.id &&
    prev.currentUser.username === next.currentUser.username &&
    prev.send === next.send &&
    prev.onMediaLoad === next.onMediaLoad,
);
