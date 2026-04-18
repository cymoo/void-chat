import {
  memo,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useChatStore } from "@/stores/chatStore";
import { renderMarkdown } from "@/lib/markdown";
import { formatTime } from "@/lib/utils";
import { MessageInputBar } from "@/components/shared/MessageInputBar";
import { MessageContent } from "@/components/chat/MessageContent";
import { Modal } from "@/components/ui/Modal";
import { openImageGallery } from "@/components/ui/ImageViewer";
import type { PrivateMessage, User, WsSendPayload } from "@/api/types";

interface PrivateChatProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

interface PrivateMessageItemProps {
  message: PrivateMessage;
  currentUserId: number;
  allMessages: PrivateMessage[];
}

const PrivateMessageItem = memo(
  ({ message, currentUserId, allMessages }: PrivateMessageItemProps) => {
    const isSelf = message.senderId === currentUserId;
    const textHtml = useMemo(() => {
      if (message.messageType !== "text") return null;
      return renderMarkdown(message.content ?? "");
    }, [message]);

    const renderContent = () => {
      if (message.messageType === "text") {
        return (
          <MessageContent
            type="text"
            contentHtml={textHtml ?? ""}
            textClassName="private-msg-content"
          />
        );
      }
      if (message.messageType === "image") {
        const handleImageClick = () => {
          const imageMessages = allMessages.filter((m) => m.messageType === "image");
          const items = imageMessages.map((m) => ({
            src: m.fileUrl ?? "",
            width: m.width ?? undefined,
            height: m.height ?? undefined,
          }));
          const clickedIndex = imageMessages.findIndex((m) => m.id === message.id);
          openImageGallery(items, Math.max(0, clickedIndex));
        };
        return (
          <MessageContent
            type="image"
            imageUrl={message.fileUrl ?? ""}
            width={message.width}
            height={message.height}
            onImageClick={handleImageClick}
            textClassName="private-msg-content"
          />
        );
      }
      if (message.messageType === "file") {
        return (
          <MessageContent
            type="file"
            fileName={message.fileName ?? ""}
            fileUrl={message.fileUrl ?? ""}
            fileSize={message.fileSize ?? 0}
            textClassName="private-msg-content"
          />
        );
      }
      return null;
    };

    return (
      <div
        className={`private-msg ${isSelf ? "private-msg-self" : "private-msg-other"}`}
      >
        <div className="private-msg-meta">
          <div className="private-msg-author">{isSelf ? "You" : message.senderUsername}</div>
          <div className="private-msg-time">{formatTime(message.timestamp)}</div>
        </div>
        {renderContent()}
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.currentUserId === next.currentUserId &&
    prev.allMessages === next.allMessages,
);

export function PrivateChat({ send, currentUser }: PrivateChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);

  const handleClose = useCallback(() => {
    if (privateChatUserId) {
      send({ type: "mark_read", targetUserId: privateChatUserId });
    }
    closePrivateChat();
  }, [privateChatUserId, send, closePrivateChat]);

  const syncToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, []);

  useEffect(() => {
    syncToBottom();
  }, [privateMessages, syncToBottom]);

  const onSubmit = useCallback(
    (text: string) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, content: text });
    },
    [privateChatUserId, send],
  );

  const onImageUploaded = useCallback(
    (url: string, thumbnailUrl?: string, width?: number, height?: number) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, imageUrl: url, thumbnailUrl, width, height });
    },
    [privateChatUserId, send],
  );

  const onFileUploaded = useCallback(
    (fileName: string, fileUrl: string, fileSize: number, mimeType: string) => {
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, fileName, fileUrl, fileSize, mimeType });
    },
    [privateChatUserId, send],
  );

  return (
    <Modal open onClose={handleClose} overlayClassName="modal-overlay-private">
      <div className="private-chat-panel">
        <div className="private-chat-header">
          <span>DM: {privateChatUsername}</span>
          <button className="modal-close panel-close-btn" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="private-chat-messages" ref={messagesContainerRef}>
          {privateMessages.map((msg) => (
            <PrivateMessageItem
              key={msg.id}
              message={msg}
              currentUserId={currentUser.id}
              allMessages={privateMessages}
            />
          ))}
        </div>
        <MessageInputBar
          onSubmit={onSubmit}
          onImageUploaded={onImageUploaded}
          onFileUploaded={onFileUploaded}
          placeholder="Message..."
          hintText="Enter send • Shift+Enter new line • Paste image / emoji supported"
          autoFocus
          ariaLabel="direct message"
        />
      </div>
    </Modal>
  );
}
