import { useState } from "react";
import { Users, Search, Bot, UserCircle, MessageSquare, ArrowLeft } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { useRoomStore } from "@/stores/roomStore";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { UserSidebar } from "./UserSidebar";
import { SearchPanel } from "./SearchPanel";
import { TypingIndicator } from "./TypingIndicator";
import { InvitePersonaModal } from "./InvitePersonaModal";
import type { User, WsSendPayload } from "@/api/types";

interface ChatViewProps {
  send: (payload: WsSendPayload) => void;
  roomName: string;
  currentUser: User;
  onDisconnect: () => void;
  onOpenMailbox: () => void;
  onOpenProfile: () => void;
  wsStatus?: "connecting" | "connected" | "reconnecting" | "failed";
}

export function ChatView({
  send,
  roomName,
  currentUser,
  onDisconnect,
  onOpenMailbox,
  onOpenProfile,
  wsStatus,
}: ChatViewProps) {
  const users = useChatStore((s) => s.users);
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const initialLoaded = useChatStore((s) => s.initialLoaded);
  const [usersPanelOpen, setUsersPanelOpen] = useState(() => window.innerWidth > 768);
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const { searchOpen, toggleSearch } = useUiStore();
  const currentRoomId = useRoomStore((s) => s.currentRoomId);
  const rooms = useRoomStore((s) => s.rooms);

  const roomCreatorId = rooms.find((r) => r.id === currentRoomId)?.creatorId ?? null;
  const currentUserRole = users.find((u) => u.id === currentUser.id)?.role ?? "member";
  const canInvitePersona =
    roomCreatorId === currentUser.id ||
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "moderator" ||
    currentUser.role === "platform_admin" ||
    currentUser.role === "super_admin";

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <div className="room-name">{roomName}</div>
          <div className="room-status">
            <span className="pulse-dot" />
            <span>{users.length} ONLINE</span>
          </div>
        </div>
        <div className="header-right">
          <div className="header-tools">
            <button
              className="icon-btn"
              title={usersPanelOpen ? "Hide users list" : "Show users list"}
              aria-label={usersPanelOpen ? "Hide users list" : "Show users list"}
              onClick={() => setUsersPanelOpen((open) => !open)}
            >
              <Users size={20} />
              <span className="header-icon-count">{users.length}</span>
            </button>
            <button className="icon-btn" title="Search Messages" aria-label="Search messages" onClick={toggleSearch}>
              <Search size={20} />
            </button>
            {canInvitePersona && (
              <button
                className="icon-btn"
                title="Invite AI Persona"
                aria-label="Invite AI persona"
                onClick={() => setPersonaModalOpen(true)}
              >
                <Bot size={20} />
              </button>
            )}
            <button className="icon-btn" title="My Profile" aria-label="Open my profile" onClick={onOpenProfile}>
              <UserCircle size={20} />
            </button>
            <button
              className="icon-btn dm-badge-btn"
              title="Private mailbox"
              aria-label={`Open private mailbox, unread: ${unreadDmCount}`}
              onClick={onOpenMailbox}
            >
              <MessageSquare size={20} />
              {unreadDmCount > 0 && <span className="dm-unread-count">{unreadDmCount}</span>}
            </button>
          </div>
          <div className="header-session">
            <div className="user-info">
              <span className="user-label">LOGGED AS:</span>
              <span className="user-name">{currentUser.username}</span>
            </div>
            <button
              className="icon-btn"
              title="Back to Lobby"
              aria-label="Back to lobby"
              onClick={onDisconnect}
            >
              <ArrowLeft size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status Banner — only after initial load to avoid stacking with the channel loader */}
      {initialLoaded && wsStatus === "reconnecting" && (
        <div className="connection-banner reconnecting">⟳ RECONNECTING...</div>
      )}
      {initialLoaded && wsStatus === "connecting" && (
        <div className="connection-banner connecting">CONNECTING...</div>
      )}

      {/* Search Bar */}
      {searchOpen && <SearchPanel send={send} />}

      {/* Chat Content */}
      <div className="chat-content">
        <div className="messages-panel">
          <MessageList send={send} currentUser={currentUser} />
        </div>
        <button
          type="button"
          className={`users-sidebar-backdrop${usersPanelOpen ? " active" : ""}`}
          aria-label="Close users list"
          onClick={() => setUsersPanelOpen(false)}
        />
        <UserSidebar
          send={send}
          currentUser={currentUser}
          isOpen={usersPanelOpen}
          onClose={() => setUsersPanelOpen(false)}
        />
      </div>

      {/* Input */}
      <TypingIndicator currentUserId={currentUser.id} />
      <MessageInput send={send} currentUser={currentUser} />

      {/* Invite Persona Modal */}
      {personaModalOpen && currentRoomId && (
        <InvitePersonaModal
          roomId={currentRoomId}
          onClose={() => setPersonaModalOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
