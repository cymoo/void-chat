import { useState, type FormEvent } from "react";

interface RoomPasswordModalProps {
  roomName: string;
  onJoin: (password: string) => void;
  onClose: () => void;
}

export function RoomPasswordModal({ onJoin, onClose }: RoomPasswordModalProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onJoin(password);
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="room-password-panel">
        <div className="panel-header">
          <span className="panel-title">PRIVATE ROOM</span>
          <button className="modal-close panel-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form className="room-password-content" onSubmit={handleSubmit}>
          <p className="room-password-info">
            This room requires a password to join.
          </p>
          <div className="input-group">
            <label className="input-label">&gt; PASSWORD</label>
            <input
              className="terminal-input"
              type="password"
              placeholder="Enter room password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="room-password-actions">
            <button className="icon-btn" type="button" onClick={onClose}>
              CANCEL
            </button>
            <button className="connect-btn" type="submit" style={{ flex: 1, marginTop: 0 }}>
              <span className="btn-text">JOIN &gt;&gt;</span>
              <span className="btn-scan" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
