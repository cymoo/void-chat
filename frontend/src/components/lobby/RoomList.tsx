import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import type { RoomInfo } from "@/api/types";

export function RoomList() {
  const rooms = useRoomStore((s) => s.rooms);
  const fetchRooms = useRoomStore((s) => s.fetchRooms);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const loading = useRoomStore((s) => s.loading);
  const addToast = useUiStore((s) => s.addToast);
  const navigate = useNavigate();
  const [passwordPrompt, setPasswordPrompt] = useState<RoomInfo | null>(null);
  const [roomPassword, setRoomPassword] = useState("");

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleJoin = (room: RoomInfo) => {
    if (room.isPrivate) {
      setPasswordPrompt(room);
      setRoomPassword("");
      return;
    }
    joinRoom(room.id, room.name);
    navigate(`/chat/${room.id}`);
  };

  const handlePasswordSubmit = () => {
    if (!passwordPrompt) return;
    if (!roomPassword) {
      addToast("Password required", "error");
      return;
    }
    joinRoom(passwordPrompt.id, passwordPrompt.name, roomPassword);
    navigate(`/chat/${passwordPrompt.id}`);
    setPasswordPrompt(null);
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="text-terminal-text-dim text-center py-8">
        LOADING ROOMS...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.length === 0 ? (
        <div className="text-terminal-text-dim text-center py-8">
          No rooms available. Create one to get started.
        </div>
      ) : (
        rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleJoin(room)}
            className="w-full text-left border border-terminal-border p-3 hover:border-terminal-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-terminal-green">{">"}</span>
                <span className="text-terminal-text-bright group-hover:text-terminal-green">
                  {room.name}
                </span>
                {room.isPrivate && (
                  <span className="text-terminal-amber text-xs">[LOCKED]</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-terminal-text-dim">
                <span>
                  <span className="text-terminal-green">{room.onlineUsers}</span>
                  /{room.maxUsers} online
                </span>
              </div>
            </div>
            {room.description && (
              <div className="text-terminal-text-dim text-xs mt-1 ml-5">
                {room.description}
              </div>
            )}
          </button>
        ))
      )}

      {/* Password prompt modal */}
      {passwordPrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-terminal-surface border border-terminal-border p-6 max-w-sm w-full mx-4">
            <div className="text-terminal-amber text-sm mb-4">
              ROOM [{passwordPrompt.name}] REQUIRES PASSWORD:
            </div>
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none mb-4"
              placeholder="enter room password..."
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 border border-terminal-green text-terminal-green px-3 py-1 text-sm hover:bg-terminal-green hover:text-terminal-bg transition-colors"
              >
                [ ENTER ]
              </button>
              <button
                onClick={() => setPasswordPrompt(null)}
                className="flex-1 border border-terminal-border text-terminal-text-dim px-3 py-1 text-sm hover:border-terminal-red hover:text-terminal-red transition-colors"
              >
                [ CANCEL ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
