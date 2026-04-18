import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { useDirectWebSocket } from "@/hooks/useDirectWebSocket";
import { CreateRoomModal } from "@/components/lobby/CreateRoomDialog";
import { EditRoomModal } from "@/components/lobby/EditRoomDialog";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { RoomPasswordModal } from "@/components/lobby/RoomPasswordModal";
import { PrivateChat } from "@/components/chat/PrivateChat";
import * as api from "@/api/client";
import type { RoomInfo } from "@/api/types";

export function LobbyPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { rooms, loading, fetchRooms, joinRoom, deleteRoom } = useRoomStore();
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const {
    profileOpen,
    setProfileOpen,
    createRoomOpen,
    setCreateRoomOpen,
  } = useUiStore();
  const addToast = useUiStore((s) => s.addToast);
  const confirm = useUiStore((s) => s.confirm);

  const [passwordRoom, setPasswordRoom] = useState<RoomInfo | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomInfo | null>(null);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const { send: sendDirectDm } = useDirectWebSocket({ token: token ?? "" });
  const canAccessAdminDashboard = Boolean(
    user?.capabilities?.canAccessAdminDashboard ||
      user?.role === "platform_admin" ||
      user?.role === "super_admin",
  );

  const loadUnreadDmCount = useCallback(async () => {
    try {
      const unread = await api.getDmInbox();
      setDmUnreadCount(
        unread.reduce((sum, item) => sum + Math.max(0, item.unreadCount), 0),
      );
    } catch {
      setDmUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    void loadUnreadDmCount();
  }, [loadUnreadDmCount]);

  const handleRoomClick = (room: RoomInfo) => {
    if (room.isPrivate) {
      setPasswordRoom(room);
    } else {
      joinRoom(room.id, room.name);
      navigate(`/chat/${room.id}`);
    }
  };

  const handlePasswordJoin = (password: string) => {
    if (passwordRoom) {
      joinRoom(passwordRoom.id, passwordRoom.name, password);
      navigate(`/chat/${passwordRoom.id}`);
      setPasswordRoom(null);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, room: RoomInfo) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "DELETE ROOM",
      message: `Delete room "${room.name}"? This cannot be undone.`,
      confirmText: "DELETE",
      cancelText: "CANCEL",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteRoom(room.id);
      addToast(`Room "${room.name}" deleted`, "success");
    } catch {
      addToast("Failed to delete room", "error");
    }
  };

  const handleEditRoom = (e: React.MouseEvent, room: RoomInfo) => {
    e.stopPropagation();
    setEditingRoom(room);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div id="lobby-screen" className="screen active">
      <div className="lobby-container">
        <div className="lobby-header">
          <div className="lobby-title-section">
            <div className="lobby-title">LOBBY</div>
            <div className="lobby-user-info">
              <span className="user-name">{user?.username ?? "USER"}</span>
            </div>
          </div>
          <div className="lobby-actions">
            <button
              className="icon-btn lobby-action-btn"
              title="My Profile"
              onClick={() => setProfileOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="btn-label">PROFILE</span>
            </button>
            <button
              className="icon-btn lobby-action-btn dm-badge-btn"
              title="Private Mailbox"
              onClick={() =>
                navigate("/mailbox", {
                  state: { returnTo: "/lobby" },
                })
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="btn-label">MAILBOX</span>
              {dmUnreadCount > 0 && <span className="dm-unread-count">{dmUnreadCount}</span>}
            </button>
            <button
              className="icon-btn lobby-action-btn"
              title="Create Room"
              onClick={() => setCreateRoomOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="btn-label">NEW ROOM</span>
            </button>
            {canAccessAdminDashboard && (
              <button
                className="icon-btn lobby-action-btn"
                title="Admin Dashboard"
                onClick={() => navigate("/admin")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 8h6" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
                <span className="btn-label">ADMIN</span>
              </button>
            )}
            <button
              className="icon-btn lobby-action-btn"
              title="Logout"
              onClick={handleLogout}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="btn-label">LOGOUT</span>
            </button>
          </div>
        </div>

        <div className="lobby-rooms-grid">
          {loading ? (
            <div className="lobby-loading">LOADING ROOMS...</div>
          ) : rooms.length === 0 ? (
            <div className="lobby-loading">NO ROOMS AVAILABLE. CREATE ONE!</div>
          ) : (
            rooms.map((room) => (
              // Platform admins can manage any room; creators can always manage their own room.
              // UI visibility mirrors backend checks but backend remains source of truth.
              <div
                key={room.id}
                className="room-card"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRoomClick(room);
                  }
                }}
                onClick={() => handleRoomClick(room)}
              >
                <div className="room-card-header">
                  <div className="room-card-name">
                    {room.name}
                    {room.isPrivate && <span className="room-lock-icon">🔒</span>}
                  </div>
                  {(room.creatorId === user?.id || canAccessAdminDashboard) && (
                    <div className="room-card-actions">
                      <button
                        className="icon-btn room-edit-btn"
                        title="Edit room"
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleEditRoom(e, room)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      <button
                        className="icon-btn room-delete-btn"
                        title="Delete room"
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDeleteRoom(e, room)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {room.description && (
                  <div className="room-card-desc">{room.description}</div>
                )}
                <div className="room-card-meta">
                  <span className="pulse-dot" />
                  {room.onlineUsers}/{room.maxUsers} ONLINE
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {createRoomOpen && <CreateRoomModal />}
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
        />
      )}
      {profileOpen && <ProfileModal />}
      {privateChatUserId !== null && user && <PrivateChat send={sendDirectDm} currentUser={user} />}
      {passwordRoom && (
        <RoomPasswordModal
          roomName={passwordRoom.name}
          onJoin={handlePasswordJoin}
          onClose={() => setPasswordRoom(null)}
        />
      )}
    </div>
  );
}
