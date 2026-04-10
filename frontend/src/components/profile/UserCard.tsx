import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials, formatDate } from "@/lib/utils";
import type { User, WsSendPayload } from "@/api/types";

interface UserCardProps {
  send: (payload: WsSendPayload) => void;
}

export function UserCard({ send }: UserCardProps) {
  const userId = useUiStore((s) => s.userCardUserId);
  const hideUserCard = useUiStore((s) => s.hideUserCard);
  const users = useChatStore((s) => s.users);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    if (userId) {
      // Try to find in online users first
      const onlineUser = users.find((u) => u.id === userId);
      if (onlineUser) {
        setProfile(onlineUser);
      }
      // Also fetch full profile from API
      api.getUser(userId).then(setProfile).catch(() => {});
    }
  }, [userId, users]);

  if (!userId || !profile) return null;

  const isOnline = users.some((u) => u.id === userId);

  const handleDm = () => {
    openPrivateChat(profile.id, profile.username);
    send({ type: "private_history", targetUserId: profile.id });
    hideUserCard();
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={hideUserCard} />
      <div className="user-profile-panel">
        <div className="profile-header">
          <button className="modal-close panel-close-btn" onClick={hideUserCard}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="profile-content">
          <div className="profile-avatar-large">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} className="avatar-img-large" />
            ) : (
              getInitials(profile.username)
            )}
          </div>
          <div className="profile-display-name">{profile.username}</div>
          {isOnline && <div className="profile-online-badge">● ONLINE</div>}
          {profile.status && <div className="profile-status">{profile.status}</div>}
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          <div className="profile-joined">Joined: {formatDate(profile.createdAt)}</div>
          <div className="profile-actions">
            <button className="profile-action-btn" onClick={handleDm}>
              Private Message
            </button>
            <button
              className="profile-action-btn"
              onClick={() => {
                hideUserCard();
                // Insert @mention into input - dispatch custom event
                const input = document.querySelector(".message-input") as HTMLTextAreaElement;
                if (input) {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    "value",
                  )?.set;
                  nativeInputValueSetter?.call(input, input.value + `@${profile.username} `);
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                  input.focus();
                }
              }}
            >
              @Mention
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
