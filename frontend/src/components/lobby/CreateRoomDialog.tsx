import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";

export function CreateRoomModal() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useRoomStore();
  const { setCreateRoomOpen, addToast } = useUiStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const room = await createRoom({
        name,
        description: description || null,
        isPrivate: visibility === "private",
        password: visibility === "private" ? password : null,
      });
      setCreateRoomOpen(false);
      joinRoom(room.id, room.name, visibility === "private" ? password : undefined);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    }
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => setCreateRoomOpen(false)} />
      <div className="create-room-panel">
        <div className="panel-header">
          <span className="panel-title">NEW ROOM</span>
          <button
            className="modal-close panel-close-btn"
            onClick={() => setCreateRoomOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form className="create-room-content" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">&gt; ROOM NAME</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="my-awesome-room"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">&gt; DESCRIPTION (optional)</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="What is this room about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">&gt; VISIBILITY</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="room-visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                PUBLIC
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="room-visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                PRIVATE
              </label>
            </div>
          </div>
          {visibility === "private" && (
            <div className="input-group">
              <label className="input-label">&gt; ROOM PASSWORD</label>
              <input
                className="terminal-input"
                type="password"
                placeholder="Room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <button className="connect-btn" type="submit" style={{ marginTop: 0 }}>
            <span className="btn-text">CREATE ROOM &gt;&gt;</span>
            <span className="btn-scan" />
          </button>
        </form>
      </div>
    </div>
  );
}
