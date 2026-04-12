import { useState, type FormEvent } from "react";
import type { RoomInfo } from "@/api/types";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";

interface EditRoomModalProps {
  room: RoomInfo;
  onClose: () => void;
}

export function EditRoomModal({ room, onClose }: EditRoomModalProps) {
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const addToast = useUiStore((s) => s.addToast);
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    room.isPrivate ? "private" : "public",
  );
  const [password, setPassword] = useState("");
  const [maxUsers, setMaxUsers] = useState(String(room.maxUsers ?? 100));
  const [saving, setSaving] = useState(false);

  const requiresPassword = visibility === "private" && !room.isPrivate;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedPassword = password.trim();
    if (!trimmedName) {
      addToast("Room name is required", "error");
      return;
    }
    if (requiresPassword && !trimmedPassword) {
      addToast("Password is required when switching to private", "error");
      return;
    }
    const parsedMaxUsers = Number(maxUsers);
    if (!Number.isInteger(parsedMaxUsers) || parsedMaxUsers < 1 || parsedMaxUsers > 1000) {
      addToast("Room capacity must be an integer between 1 and 1000", "error");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateRoom(room.id, {
        name: trimmedName,
        description: trimmedDescription || null,
        isPrivate: visibility === "private",
        password: visibility === "private" ? (trimmedPassword || null) : null,
        maxUsers: parsedMaxUsers,
      });
      addToast(`Room "${updated.name}" updated`, "success");
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update room", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="create-room-panel">
        <div className="panel-header">
          <span className="panel-title">EDIT ROOM</span>
          <button
            className="modal-close panel-close-btn"
            onClick={onClose}
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
                  name="edit-room-visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                PUBLIC
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="edit-room-visibility"
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
                placeholder={
                  room.isPrivate
                    ? "Leave blank to keep current password"
                    : "Set room password"
                }
                value={password}
                required={requiresPassword}
                onChange={(e) => setPassword(e.target.value)}
              />
              {room.isPrivate && (
                <div className="room-field-hint">
                  Leave password blank to keep the current one.
                </div>
              )}
            </div>
          )}
          <button className="connect-btn" type="submit" style={{ marginTop: 0 }} disabled={saving}>
            <span className="btn-text">{saving ? "SAVING..." : "SAVE CHANGES >>"}</span>
            <span className="btn-scan" />
          </button>
        </form>
      </div>
    </div>
  );
}
