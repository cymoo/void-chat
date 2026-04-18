import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import { getInitials } from "@/lib/utils";
import type { User, WsSendPayload } from "@/api/types";

interface UserSidebarProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

export function UserSidebar({ send, currentUser, isOpen, onClose }: UserSidebarProps) {
  const users = useChatStore((s) => s.users);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const showUserCard = useUiStore((s) => s.showUserCard);

  // Sort: bots first, then regular users
  const sortedUsers = [...users].sort((a, b) => {
    const aBot = a.isBot ? 1 : 0;
    const bBot = b.isBot ? 1 : 0;
    return bBot - aBot;
  });

  const roomCreatorId = useRoomStore((s) => s.rooms).find(
    (room) => room.id === useRoomStore.getState().currentRoomId,
  )?.creatorId ?? null;

  const isOwner = (user: User) => user.role === "owner" || roomCreatorId === user.id;

  const handleDm = (user: User) => {
    onClose();
    openPrivateChat(user.id, user.username);
    send({ type: "private_history", targetUserId: user.id });
  };

  return (
    <div className={`users-sidebar${isOpen ? " open" : " collapsed"}`} aria-label="Online users">
      <div className="sidebar-header">
        <div className="sidebar-title">USERS ONLINE</div>
        <div className="sidebar-count">{users.length}</div>
        <button
          type="button"
          className="icon-btn users-sidebar-close"
          aria-label="Close users list"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="users-list" role="list">
        {sortedUsers.map((user) => {
          const owner = isOwner(user);
          return (
            <div
              key={user.id}
              className={`user-item${user.isBot ? " user-item-bot" : ""}`}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  showUserCard(user.id);
                }
              }}
              onClick={() => showUserCard(user.id)}
            >
              <div className="user-item-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName ?? user.username}
                    loading="lazy"
                    className="avatar-img"
                  />
                ) : user.isBot ? (
                  <span className="bot-avatar-icon">🤖</span>
                ) : (
                  getInitials(user.displayName ?? user.username)
                )}
              </div>
              <div className="user-item-info">
                <div className="user-item-name">
                  {user.displayName ?? user.username}
                  {!user.isBot && (owner ? (
                    <span className="role-badge role-owner-icon" title="Room owner" aria-label="Room owner">
                      ♛
                    </span>
                  ) : (
                    user.role &&
                    user.role !== "member" && (
                      <span className={`role-badge role-${user.role}`}>{user.role.toUpperCase()}</span>
                    )
                  ))}
                </div>
                {!user.isBot && user.status && <div className="user-item-status">{user.status}</div>}
              </div>
              {user.id !== currentUser.id && !user.isBot && (
                <div className="user-item-actions">
                  <button
                    type="button"
                    className="dm-btn"
                    title="Send DM"
                    aria-label={`Send direct message to ${user.username}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDm(user);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
