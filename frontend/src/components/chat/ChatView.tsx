import { useState } from "react";
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
  wsStatus?: "connecting" | "connected" | "reconnecting" | "failed";
}

export function ChatView({
  send,
  roomName,
  currentUser,
  onDisconnect,
  onOpenMailbox,
  wsStatus,
}: ChatViewProps) {
  const users = useChatStore((s) => s.users);
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const initialLoaded = useChatStore((s) => s.initialLoaded);
  const [usersPanelOpen, setUsersPanelOpen] = useState(() => window.innerWidth > 768);
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const { searchOpen, toggleSearch, setProfileOpen } = useUiStore();
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span className="header-icon-count">{users.length}</span>
            </button>
            <button className="icon-btn" title="Search Messages" aria-label="Search messages" onClick={toggleSearch}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            {canInvitePersona && (
              <button
                className="icon-btn"
                title="Invite AI Persona"
                aria-label="Invite AI persona"
                onClick={() => setPersonaModalOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <line x1="12" y1="16" x2="12" y2="22" />
                  <line x1="9" y1="19" x2="15" y2="19" />
                </svg>
              </button>
            )}
            <button className="icon-btn" title="My Profile" aria-label="Open my profile" onClick={() => setProfileOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              className="icon-btn dm-badge-btn"
              title="Private mailbox"
              aria-label={`Open private mailbox, unread: ${unreadDmCount}`}
              onClick={onOpenMailbox}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
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
