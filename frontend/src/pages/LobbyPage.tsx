import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import { CreateRoomModal } from "@/components/lobby/CreateRoomDialog";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { RoomPasswordModal } from "@/components/lobby/RoomPasswordModal";
import type { RoomInfo } from "@/api/types";

export function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { rooms, loading, fetchRooms, joinRoom } = useRoomStore();
  const { profileOpen, setProfileOpen, createRoomOpen, setCreateRoomOpen } = useUiStore();

  const [passwordRoom, setPasswordRoom] = useState<RoomInfo | null>(null);

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

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div id="lobby-screen" className="screen">
      <div className="lobby-container">
        <div className="lobby-header">
          <div className="lobby-title-section">
            <div className="lobby-title">SELECT ROOM</div>
            <div className="lobby-user-info">
              <span className="user-label">LOGGED AS:</span>
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
              MY PROFILE
            </button>
            <button
              className="icon-btn lobby-action-btn"
              title="Create Room"
              onClick={() => setCreateRoomOpen(true)}
            >
              + NEW ROOM
            </button>
            <button
              className="icon-btn lobby-action-btn"
              title="Logout"
              onClick={handleLogout}
            >
              LOGOUT
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
                onClick={() => handleRoomClick(room)}
              >
                <div className="room-card-header">
                  <div className="room-card-name">
                    {room.name}
                    {room.isPrivate && <span className="room-lock-icon">🔒</span>}
                  </div>
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
