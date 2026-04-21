import { useState } from "react";
import { MessageSquare, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { BotAvatarIcon } from "@/components/shared/BotAvatarIcon";
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
  onLeaveRoom: () => void;
}

export function UserSidebar({ send, currentUser, isOpen, onClose, onLeaveRoom }: UserSidebarProps) {
  const users = useChatStore((s) => s.users);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const showUserCard = useUiStore((s) => s.showUserCard);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  const roomCreatorId =
    useRoomStore((s) => s.rooms).find((room) => room.id === useRoomStore.getState().currentRoomId)
      ?.creatorId ?? null;

  const isOwner = (user: User) => user.role === "owner" || roomCreatorId === user.id;

  const sortByBot = (a: User, b: User) => (b.isBot ? 1 : 0) - (a.isBot ? 1 : 0);
  const onlineUsers = [...users.filter((u) => u.isOnline)].sort(sortByBot);
  const offlineMembers = [...users.filter((u) => !u.isOnline)].sort(sortByBot);

  const handleDm = (user: User) => {
    // On mobile, the sidebar is a drawer overlay — close it before opening DM
    if (window.innerWidth <= 768) onClose();
    openPrivateChat(user.id, user.username);
    send({ type: "private_history", targetUserId: user.id });
  };

  const renderUser = (user: User, dimmed = false) => {
    const owner = isOwner(user);
    return (
      <div
        key={user.id}
        className={`user-item${user.isBot ? " user-item-bot" : ""}${dimmed ? " user-item-offline" : ""}`}
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
            <span className="bot-avatar-icon"><BotAvatarIcon size={18} /></span>
          ) : (
            getInitials(user.displayName ?? user.username)
          )}
        </div>
        <div className="user-item-info">
          <div className="user-item-name">
            {user.displayName ?? user.username}
            {!user.isBot &&
              (owner ? (
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
        {user.id !== currentUser.id && !user.isBot ? (
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
              <MessageSquare size={14} />
            </button>
          </div>
        ) : user.id === currentUser.id ? (
          <div className="user-item-actions">
            <button
              type="button"
              className="leave-room-btn-inline"
              title="Leave Room"
              aria-label="Leave this room"
              onClick={(e) => {
                e.stopPropagation();
                onLeaveRoom();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onLeaveRoom();
                }
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`users-sidebar${isOpen ? " open" : " collapsed"}`} aria-label="Room members">
      <div className="sidebar-header">
        <div className="sidebar-title">USERS</div>
        <div className="sidebar-count">
          {onlineUsers.length}/{users.length}
        </div>
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
        {onlineUsers.map((user) => renderUser(user))}

        {offlineMembers.length > 0 && (
          <>
            <button
              type="button"
              className="offline-section-toggle"
              onClick={() => setOfflineExpanded((e) => !e)}
              aria-expanded={offlineExpanded}
            >
              {offlineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>OFFLINE — {offlineMembers.length}</span>
            </button>
            {offlineExpanded && offlineMembers.map((user) => renderUser(user, true))}
          </>
        )}
      </div>
    </div>
  );
}

