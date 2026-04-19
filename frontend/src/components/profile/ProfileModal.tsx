import { useState, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const addToast = useUiStore((s) => s.addToast);

  const [username, setUsername] = useState(user?.username ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const result = await api.uploadImage(file);
      if (result.url) {
        const updated = await api.updateProfile({ avatarUrl: result.url });
        updateUser(updated);
        addToast("Avatar updated", "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "头像上传失败";
      addToast(msg, "error");
    } finally {
      setAvatarUploading(false);
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      addToast("Username is required", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ username: trimmedUsername, status, bio });
      updateUser(updated);
      addToast("Profile updated", "success");
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update profile", "error");
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} aria-label="Edit profile">
      <div className="my-profile-panel">
        <div className="panel-header">
          <span className="panel-title">MY PROFILE</span>
          <button
            className="modal-close panel-close-btn"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="my-profile-content">
          <div className="my-profile-avatar-section">
            <label className="profile-avatar-large" title="Click to change avatar">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  loading="lazy"
                  className="avatar-img-large"
                />
              ) : (
                getInitials(user?.username ?? "??")
              )}
              {avatarUploading && (
                <div className="avatar-upload-overlay">
                  <span className="upload-spinner" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
              />
            </label>
            <div className="my-profile-avatar-hint">&gt; {avatarUploading ? "UPLOADING..." : "CLICK AVATAR TO UPLOAD"}</div>
          </div>
          <div className="input-group">
            <label className="input-label">&gt; USERNAME</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="anonymous"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">&gt; STATUS</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="What's on your mind?"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">&gt; BIO</label>
            <textarea
              className="terminal-input terminal-textarea"
              placeholder="Tell us about yourself..."
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <button
            className="connect-btn"
            onClick={handleSave}
            disabled={saving}
          >
            <span className="btn-text">SAVE PROFILE &gt;&gt;</span>
            <span className="btn-scan" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
