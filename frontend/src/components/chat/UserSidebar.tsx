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
  const confirm = useUiStore((s) => s.confirm);
  const currentRoomId = useRoomStore((s) => s.currentRoomId);
  const rooms = useRoomStore((s) => s.rooms);

  const roomCreatorId = rooms.find((room) => room.id === currentRoomId)?.creatorId ?? null;
  const currentUserRole = users.find((u) => u.id === currentUser.id)?.role ?? "member";
  const currentUserIsOwner = roomCreatorId === currentUser.id || currentUserRole === "owner";
  const canKick =
    currentUserIsOwner ||
    currentUserRole === "admin" ||
    currentUserRole === "moderator";

  const isOwner = (user: User) => user.role === "owner" || roomCreatorId === user.id;

  const handleDm = (user: User) => {
    onClose();
    openPrivateChat(user.id, user.username);
    send({ type: "private_history", targetUserId: user.id });
  };

  const handleKick = async (user: User) => {
    const confirmed = await confirm({
      title: "KICK USER",
      message: `Kick ${user.username} from this room?`,
      confirmText: "KICK",
      cancelText: "CANCEL",
      tone: "danger",
    });
    if (!confirmed) return;
    send({ type: "kick", targetUserId: user.id });
  };

  return (
    <div className={`users-sidebar${isOpen ? " open" : " collapsed"}`}>
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
      <div className="users-list">
        {users.map((user) => {
          const owner = isOwner(user);
          const canKickUser = canKick && user.id !== currentUser.id && !owner;
          return (
            <div
              key={user.id}
              className="user-item"
              role="button"
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
                  {owner ? (
                    <span className="role-badge role-owner-icon" title="Room owner" aria-label="Room owner">
                      ♛
                    </span>
                  ) : (
                    user.role &&
                    user.role !== "member" && (
                      <span className={`role-badge role-${user.role}`}>{user.role.toUpperCase()}</span>
                    )
                  )}
                </div>
                {user.status && <div className="user-item-status">{user.status}</div>}
              </div>
              {user.id !== currentUser.id && (
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
                  {canKickUser && (
                    <button
                      type="button"
                      className="dm-btn kick-btn"
                      title="Kick user"
                      aria-label={`Kick ${user.username}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleKick(user);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
