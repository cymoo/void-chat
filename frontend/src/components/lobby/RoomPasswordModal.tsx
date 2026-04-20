import { useState, type FormEvent } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface RoomPasswordModalProps {
  roomName: string;
  onJoin: (password: string) => void;
  onClose: () => void;
}

export function RoomPasswordModal({ onJoin, onClose }: RoomPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onJoin(password);
  };

  return (
    <Modal open onClose={onClose} aria-label="Room password required">
      <div className="room-password-panel">
        <div className="panel-header">
          <span className="panel-title">PRIVATE ROOM</span>
          <button className="modal-close panel-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form className="room-password-content" onSubmit={handleSubmit}>
          <p className="room-password-info">
            This room requires a password to join.
          </p>
          <div className="input-group">
            <label className="input-label">&gt; PASSWORD</label>
            <div className="password-input-wrap">
              <input
                className="terminal-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter room password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="room-password-actions">
            <button className="icon-btn" type="button" onClick={onClose}>
              CANCEL
            </button>
            <button className="connect-btn" type="submit">
              <span className="btn-text">JOIN &gt;&gt;</span>
              <span className="btn-scan" />
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
