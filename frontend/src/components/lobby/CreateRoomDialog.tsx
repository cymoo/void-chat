import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";
import { Modal } from "@/components/ui/Modal";

interface CreateRoomModalProps {
  onClose: () => void;
}

export function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const navigate = useNavigate();
  const createRoom = useRoomStore((s) => s.createRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const addToast = useUiStore((s) => s.addToast);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [maxUsers, setMaxUsers] = useState("100");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedMaxUsers = Number(maxUsers);
    if (!Number.isInteger(parsedMaxUsers) || parsedMaxUsers < 1 || parsedMaxUsers > 1000) {
      addToast("Room capacity must be an integer between 1 and 1000", "error");
      return;
    }
    try {
      const room = await createRoom({
        name,
        description: description || null,
        isPrivate: visibility === "private",
        password: visibility === "private" ? password : null,
        maxUsers: parsedMaxUsers,
      });
      onClose();
      joinRoom(room.id, room.name, visibility === "private" ? password : undefined);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="create-room-panel">
        <div className="panel-header">
          <span className="panel-title">NEW ROOM</span>
          <button
            className="modal-close panel-close-btn"
            onClick={onClose}
          >
            <X size={20} />
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
          <div className="input-group">
            <label className="input-label">&gt; ROOM CAPACITY</label>
            <input
              className="terminal-input"
              type="number"
              min={1}
              max={1000}
              placeholder="100"
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
            />
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
          <button className="connect-btn" type="submit">
            <span className="btn-text">CREATE ROOM &gt;&gt;</span>
            <span className="btn-scan" />
          </button>
        </form>
      </div>
    </Modal>
  );
}
