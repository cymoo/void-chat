import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { getInitials } from "@/lib/utils";
import type { User, WsSendPayload } from "@/api/types";

interface UserSidebarProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

export function UserSidebar({ send, currentUser }: UserSidebarProps) {
  const users = useChatStore((s) => s.users);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const showUserCard = useUiStore((s) => s.showUserCard);

  const handleDm = (user: User) => {
    openPrivateChat(user.id, user.username);
    send({ type: "private_history", targetUserId: user.id });
  };

  return (
    <div className="users-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">USERS ONLINE</div>
        <div className="sidebar-count">{users.length}</div>
      </div>
      <div className="users-list">
        {users.map((user) => (
          <div
            key={user.id}
            className="user-item"
            onClick={() => showUserCard(user.id)}
          >
            <div className="user-item-avatar">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "2px" }}
                />
              ) : (
                getInitials(user.username)
              )}
            </div>
            <div className="user-item-info">
              <div className="user-item-name">
                {user.username}
                {user.role && user.role !== "member" && (
                  <span className={`role-badge role-${user.role}`}>
                    {user.role.toUpperCase()}
                  </span>
                )}
              </div>
              {user.status && (
                <div className="user-item-status">{user.status}</div>
              )}
            </div>
            {user.id !== currentUser.id && (
              <button
                className="dm-btn"
                title="Send DM"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDm(user);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
