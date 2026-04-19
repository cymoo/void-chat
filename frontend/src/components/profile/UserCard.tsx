import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import * as api from "@/api/client";
import { getInitials, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { openSingleImage } from "@/components/ui/ImageViewer";
import type { User, WsSendPayload } from "@/api/types";

interface UserCardProps {
  send: (payload: WsSendPayload) => void;
}

export function UserCard({ send }: UserCardProps) {
  const userId = useUiStore((s) => s.userCardUserId);
  const hideUserCard = useUiStore((s) => s.hideUserCard);
  const confirm = useUiStore((s) => s.confirm);
  const users = useChatStore((s) => s.users);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const currentUser = useAuthStore((s) => s.user);
  const currentRoomId = useRoomStore((s) => s.currentRoomId);
  const rooms = useRoomStore((s) => s.rooms);
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    if (userId) {
      // Try to find in online users first (already has isBot + displayName enrichment)
      const onlineUser = users.find((u) => u.id === userId);
      if (onlineUser) {
        setProfile(onlineUser);
        // Skip API for bots — bot metadata lives in Redis, not in the user REST endpoint
        if (onlineUser.isBot) return;
      }
      // Fetch full profile from API for regular users
      api.getUser(userId).then(setProfile).catch(() => {});
    }
  }, [userId, users]);

  if (!userId || !profile || !currentUser) return null;

  const isOnline = users.some((u) => u.id === userId);

  // Kick permission logic
  const roomCreatorId = rooms.find((r) => r.id === currentRoomId)?.creatorId ?? null;
  const currentUserRoomRole = users.find((u) => u.id === currentUser.id)?.role ?? "member";
  const isPlatformAdmin = currentUser.role === "super_admin" || currentUser.role === "platform_admin";
  const currentUserIsOwner = roomCreatorId === currentUser.id || currentUserRoomRole === "owner";
  const canKick =
    isPlatformAdmin ||
    currentUserIsOwner ||
    currentUserRoomRole === "admin" ||
    currentUserRoomRole === "moderator";
  const targetIsOwner = profile.role === "owner" || roomCreatorId === profile.id;
  const canKickThisUser = canKick && profile.id !== currentUser.id && !targetIsOwner && currentRoomId !== null;

  const handleDm = () => {
    openPrivateChat(profile.id, profile.username);
    send({ type: "private_history", targetUserId: profile.id });
    hideUserCard();
  };

  const handleKick = async () => {
    const confirmed = await confirm({
      title: "KICK USER",
      message: `Kick ${profile.username} from this room?`,
      confirmText: "KICK",
      cancelText: "CANCEL",
      tone: "danger",
    });
    if (!confirmed) return;
    send({ type: "kick", targetUserId: profile.id });
    hideUserCard();
  };

  return (
    <Modal open onClose={hideUserCard}>
      <div className="user-profile-panel">
        <div className="profile-header">
          <button className="modal-close panel-close-btn" onClick={hideUserCard}>
            <X size={20} />
          </button>
        </div>
        <div className="profile-content">
          <div className="profile-avatar-large">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName ?? profile.username}
                className="avatar-img-large cursor-pointer"
                onClick={() => openSingleImage(profile.avatarUrl!)}
              />
            ) : profile.isBot ? (
              <span style={{ fontSize: "3rem" }}>🤖</span>
            ) : (
              getInitials(profile.username)
            )}
          </div>
          <div className="profile-display-name">{profile.displayName ?? profile.username}</div>
          {profile.isBot && <div className="profile-online-badge" style={{ color: "var(--color-accent)" }}>⬡ AI PERSONA</div>}
          {!profile.isBot && isOnline && <div className="profile-online-badge">● ONLINE</div>}
          {profile.status && <div className="profile-status">{profile.status}</div>}
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          {!profile.isBot && <div className="profile-joined">Joined: {formatDate(profile.createdAt)}</div>}
          {profile.id !== currentUser.id && (
            <div className="profile-actions">
              {!profile.isBot && (
                <button className="profile-action-btn" onClick={handleDm}>
                  DM
                </button>
              )}
              <button
                className="profile-action-btn"
                onClick={() => {
                  hideUserCard();
                  const input = document.querySelector(".message-input") as HTMLTextAreaElement;
                  if (input) {
                    const mentionName = profile.displayName ?? profile.username;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype,
                      "value",
                    )?.set;
                    nativeInputValueSetter?.call(input, input.value + `@${mentionName} `);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.focus();
                  }
                }}
              >
                @Mention
              </button>
              {canKickThisUser && (
                <button
                  className="profile-action-btn profile-action-danger"
                  onClick={() => void handleKick()}
                >
                  Kick
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
