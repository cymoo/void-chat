import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, MessageSquare, Plus, LayoutList, LogOut, Pencil, Trash2 } from "lucide-react";
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
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const setUnreadDmCount = useChatStore((s) => s.setUnreadDmCount);
  const addToast = useUiStore((s) => s.addToast);
  const confirm = useUiStore((s) => s.confirm);

  const [profileOpen, setProfileOpen] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<RoomInfo | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomInfo | null>(null);
  const { send: sendDirectDm } = useDirectWebSocket({ token: token ?? "" });
  const canAccessAdminDashboard = Boolean(
    user?.capabilities?.canAccessAdminDashboard ||
      user?.role === "platform_admin" ||
      user?.role === "super_admin",
  );

  const loadUnreadDmCount = useCallback(async () => {
    try {
      const unread = await api.getDmInbox();
      setUnreadDmCount(
        unread.reduce((sum, item) => sum + Math.max(0, item.unreadCount), 0),
      );
    } catch {
      setUnreadDmCount(0);
    }
  }, [setUnreadDmCount]);

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
              <UserIcon size={14} />
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
              <MessageSquare size={14} />
              <span className="btn-label">MAILBOX</span>
              {unreadDmCount > 0 && <span className="dm-unread-count">{unreadDmCount}</span>}
            </button>
            <button
              className="icon-btn lobby-action-btn"
              title="Create Room"
              onClick={() => setCreateRoomOpen(true)}
            >
              <Plus size={14} />
              <span className="btn-label">NEW ROOM</span>
            </button>
            {canAccessAdminDashboard && (
              <button
                className="icon-btn lobby-action-btn"
                title="Admin Dashboard"
                onClick={() => navigate("/admin")}
              >
                <LayoutList size={14} />
                <span className="btn-label">ADMIN</span>
              </button>
            )}
            <button
              className="icon-btn lobby-action-btn"
              title="Logout"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span className="btn-label">LOGOUT</span>
            </button>
          </div>
        </div>

        <div className="lobby-rooms-grid">
          {loading ? (
            <div className="lobby-loading">LOADING ROOMS...</div>
          ) : rooms.length === 0 ? (
            <div className="lobby-empty-state">
              <div className="lobby-empty-icon">📡</div>
              <div className="lobby-empty-text">NO ROOMS AVAILABLE</div>
              <button
                className="connect-btn"
                onClick={() => setCreateRoomOpen(true)}
              >
                <span className="btn-text">CREATE ROOM &gt;&gt;</span>
                <span className="btn-scan" />
              </button>
            </div>
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
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-btn room-delete-btn"
                        title="Delete room"
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDeleteRoom(e, room)}
                      >
                        <Trash2 size={14} />
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

      {createRoomOpen && <CreateRoomModal onClose={() => setCreateRoomOpen(false)} />}
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
        />
      )}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
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
