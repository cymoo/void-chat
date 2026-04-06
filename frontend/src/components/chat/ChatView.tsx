import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { UserSidebar } from "./UserSidebar";
import { SearchPanel } from "./SearchPanel";
import type { User, WsSendPayload } from "@/api/types";

interface ChatViewProps {
  send: (payload: WsSendPayload) => void;
  roomName: string;
  currentUser: User;
  onDisconnect: () => void;
}

export function ChatView({ send, roomName, currentUser, onDisconnect }: ChatViewProps) {
  const users = useChatStore((s) => s.users);
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const { searchOpen, toggleSearch, setProfileOpen, dmInboxOpen, setDmInboxOpen } = useUiStore();

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
          <button className="icon-btn" title="Search Messages" onClick={toggleSearch}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button className="icon-btn" title="My Profile" onClick={() => setProfileOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          {unreadDmCount > 0 && (
            <button
              className="icon-btn dm-badge-btn"
              title="Unread DMs"
              onClick={() => setDmInboxOpen(!dmInboxOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="dm-unread-count">{unreadDmCount}</span>
            </button>
          )}
          <div className="user-info">
            <span className="user-label">LOGGED AS:</span>
            <span className="user-name">{currentUser.username}</span>
          </div>
          <button className="icon-btn" title="Back to Lobby" onClick={onDisconnect}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && <SearchPanel send={send} />}

      {/* Chat Content */}
      <div className="chat-content">
        <div className="messages-panel">
          <MessageList send={send} currentUser={currentUser} />
        </div>
        <UserSidebar send={send} currentUser={currentUser} />
      </div>

      {/* Input */}
      <MessageInput send={send} currentUser={currentUser} />
    </div>
  );
}
