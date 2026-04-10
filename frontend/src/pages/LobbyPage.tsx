import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import { CreateRoomModal } from "@/components/lobby/CreateRoomDialog";
import { EditRoomModal } from "@/components/lobby/EditRoomDialog";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { RoomPasswordModal } from "@/components/lobby/RoomPasswordModal";
import type { RoomInfo } from "@/api/types";

export function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { rooms, loading, fetchRooms, joinRoom, deleteRoom } = useRoomStore();
  const { profileOpen, setProfileOpen, createRoomOpen, setCreateRoomOpen } = useUiStore();
  const addToast = useUiStore((s) => s.addToast);
  const confirm = useUiStore((s) => s.confirm);

  const [passwordRoom, setPasswordRoom] = useState<RoomInfo | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomInfo | null>(null);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
                  {room.creatorId === user?.id && (
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
                  {room.onlineUsers} ONLINE
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
