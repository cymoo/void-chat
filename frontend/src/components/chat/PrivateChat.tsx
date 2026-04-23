import {
  memo,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { X } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { renderMarkdown } from "@/lib/markdown";
import { formatTime } from "@/lib/utils";
import { MessageInputBar } from "@/components/shared/MessageInputBar";
import { SlashCommandMenu } from "@/components/shared/SlashCommandMenu";
import { MessageContent } from "@/components/chat/MessageContent";
import { Modal } from "@/components/ui/Modal";
import { openImageGallery } from "@/components/ui/ImageViewer";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { fetchDmExportMessages } from "@/lib/slashCommands";
import { exportDmChat } from "@/lib/exportChat";
import type { MessageComposerReturn } from "@/hooks/useMessageComposer";
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
  const composerRef = useRef<MessageComposerReturn | null>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);
  const clearPrivateMessages = useChatStore((s) => s.clearPrivateMessages);
  const { addToast } = useUiStore();
  const slashCmds = useSlashCommands("dm");

  // Mark messages as read when opening
  useEffect(() => {
    if (privateChatUserId) {
      send({ type: "mark_read", targetUserId: privateChatUserId });
    }
  }, [privateChatUserId, send]);

  const handleClose = useCallback(() => {
    if (privateChatUserId) {
      send({ type: "mark_read", targetUserId: privateChatUserId });
    }
    closePrivateChat();
  }, [privateChatUserId, send, closePrivateChat]);

  const syncToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    syncToBottom();
  }, [privateMessages, syncToBottom]);

  const executeSlashCommand = useCallback(
    async (name: string) => {
      slashCmds.closeMenu();
      composerRef.current?.setText("");

      if (name === "clear") {
        clearPrivateMessages();
        return;
      }

      if (name === "export") {
        if (!privateChatUserId) return;
        addToast("Exporting chat…", "info");
        try {
          const msgs = await fetchDmExportMessages(privateChatUserId);
          exportDmChat(privateChatUsername, msgs);
        } catch {
          addToast("Export failed. Please try again.", "error");
        }
        return;
      }

      // broadcast effects not available in DMs
      addToast("Effects only work in rooms.", "info");
    },
    [slashCmds, clearPrivateMessages, privateChatUserId, privateChatUsername, addToast],
  );

  const onSubmit = useCallback(
    (text: string) => {
      // Execute selected slash command on Enter
      if (slashCmds.menuOpen && slashCmds.filteredCommands.length > 0) {
        const cmd = slashCmds.filteredCommands[slashCmds.selectedIndex];
        if (cmd) {
          void executeSlashCommand(cmd.name);
          return;
        }
      }
      if (!privateChatUserId) return;
      send({ type: "private_message", targetUserId: privateChatUserId, content: text });
    },
    [slashCmds, executeSlashCommand, privateChatUserId, send],
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

  const onTextChange = useCallback(
    (val: string) => slashCmds.onTextChange(val),
    [slashCmds],
  );

  const onKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (slashCmds.menuOpen && slashCmds.filteredCommands.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
          return slashCmds.onKeyDown(e);
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const cmd = slashCmds.filteredCommands[slashCmds.selectedIndex];
          if (cmd) void executeSlashCommand(cmd.name);
          return true;
        }
      }
      return false;
    },
    [slashCmds, executeSlashCommand],
  );

  const renderAbove = useCallback(
    (composer: MessageComposerReturn) => (
      <SlashCommandMenu
        commands={slashCmds.filteredCommands}
        selectedIndex={slashCmds.selectedIndex}
        onSelect={(cmd) => void executeSlashCommand(cmd.name)}
        onClose={slashCmds.closeMenu}
        anchorEl={composer.textareaRef.current}
      />
    ),
    [slashCmds, executeSlashCommand],
  );

  return (
    <Modal open onClose={handleClose} overlayClassName="modal-overlay-private">
      <div className="private-chat-panel">
        <div className="private-chat-header">
          <span>DM: {privateChatUsername}</span>
          <button className="modal-close panel-close-btn" onClick={handleClose}>
            <X size={20} />
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
          composerRef={composerRef}
          onSubmit={onSubmit}
          onImageUploaded={onImageUploaded}
          onFileUploaded={onFileUploaded}
          onTextChange={onTextChange}
          onKeyDownCapture={onKeyDownCapture}
          renderAbove={renderAbove}
          placeholder="Message..."
          hintText="Enter send • Shift+Enter new line • / for commands • Paste image / emoji supported"
          autoFocus
          ariaLabel="direct message"
        />
      </div>
    </Modal>
  );
}
