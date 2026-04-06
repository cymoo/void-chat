import type { ChatMessage, WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { formatTime, formatFileSize, cn } from "@/lib/utils";

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  send: (payload: WsSendPayload) => void;
}

export function MessageItem({ message, isOwn, send }: MessageItemProps) {
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const showUserCard = useUiStore((s) => s.showUserCard);

  if (message.messageType === "system") {
    return (
      <div className="text-center text-terminal-text-dim text-xs py-1">
        <span className="text-terminal-amber">*</span> {message.content}{" "}
        <span className="text-terminal-border">
          [{formatTime(message.timestamp)}]
        </span>
      </div>
    );
  }

  const handleDelete = () => {
    send({ type: "delete", messageId: message.id });
  };

  return (
    <div
      className={cn(
        "group py-1 hover:bg-terminal-surface/50 px-2 -mx-2 rounded",
        isOwn && "border-l-2 border-terminal-green/20",
      )}
    >
      {/* Reply reference */}
      {message.replyTo && (
        <div className="text-xs text-terminal-text-dim ml-6 mb-0.5 flex items-center gap-1">
          <span className="text-terminal-cyan">↳</span>
          <span className="text-terminal-cyan">@{message.replyTo.username}</span>
          <span className="truncate max-w-xs">
            {message.replyTo.content}
          </span>
        </div>
      )}

      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className="text-terminal-border text-xs shrink-0 w-12 pt-0.5">
          {formatTime(message.timestamp)}
        </span>

        {/* Username */}
        {"username" in message && (
          <button
            onClick={() => "userId" in message && showUserCard(message.userId)}
            className={cn(
              "text-sm font-bold shrink-0 hover:underline",
              isOwn ? "text-terminal-green" : "text-terminal-cyan",
            )}
          >
            {message.username}
          </button>
        )}

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {message.messageType === "text" && (
            <div className="text-terminal-text text-sm break-words">
              {message.content}
              {message.editedAt && (
                <span className="text-terminal-text-dim text-xs ml-1">
                  (edited)
                </span>
              )}
            </div>
          )}

          {message.messageType === "image" && (
            <div className="mt-1">
              <a
                href={message.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src={message.thumbnailUrl ?? message.imageUrl}
                  alt="shared image"
                  className="max-w-xs max-h-48 border border-terminal-border rounded"
                  loading="lazy"
                />
              </a>
            </div>
          )}

          {message.messageType === "file" && (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-terminal-border px-3 py-1 text-sm hover:border-terminal-green transition-colors mt-1"
            >
              <span className="text-terminal-amber">📎</span>
              <span className="text-terminal-text">{message.fileName}</span>
              <span className="text-terminal-text-dim text-xs">
                ({formatFileSize(message.fileSize)})
              </span>
            </a>
          )}
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
          <button
            onClick={() => setReplyingTo(message)}
            className="text-terminal-text-dim hover:text-terminal-cyan text-xs px-1"
            title="Reply"
          >
            ↩
          </button>
          {isOwn && message.messageType === "text" && (
            <button
              onClick={() => setEditingMessage(message.id)}
              className="text-terminal-text-dim hover:text-terminal-amber text-xs px-1"
              title="Edit"
            >
              ✎
            </button>
          )}
          {isOwn && (
            <button
              onClick={handleDelete}
              className="text-terminal-text-dim hover:text-terminal-red text-xs px-1"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
