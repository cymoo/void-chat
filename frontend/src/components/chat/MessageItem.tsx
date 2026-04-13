import { memo, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { renderMarkdown, highlightMentions } from "@/lib/markdown";
import { requestMessageJump } from "@/lib/messageJump";
import { formatTime, getInitials } from "@/lib/utils";
import { MessageContent } from "@/components/chat/MessageContent";
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

  const isOwn = message.messageType !== "system" && message.userId === currentUser.id;

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
      return (
        <MessageContent
          type="image"
          imageUrl={message.imageUrl}
          onImageClick={setImageModal}
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

  return (
    <div className={`message${isOwn ? " message-self" : ""}`} data-message-id={message.id}>
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
