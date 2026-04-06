import { useState, type ChangeEvent } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials } from "@/lib/utils";

export function ProfileModal() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setProfileOpen = useUiStore((s) => s.setProfileOpen);
  const addToast = useUiStore((s) => s.addToast);

  const [status, setStatus] = useState(user?.status ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadImage(file);
      if (result.url) {
        const updated = await api.updateProfile({ avatarUrl: result.url });
        updateUser(updated);
        addToast("Avatar updated", "success");
      }
    } catch {
      addToast("Failed to upload avatar", "error");
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ status, bio });
      updateUser(updated);
      addToast("Profile updated", "success");
      setProfileOpen(false);
    } catch {
      addToast("Failed to update profile", "error");
    }
    setSaving(false);
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => setProfileOpen(false)} />
      <div className="my-profile-panel">
        <div className="panel-header">
          <span className="panel-title">MY PROFILE</span>
          <button
            className="modal-close panel-close-btn"
            onClick={() => setProfileOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="my-profile-content">
          <div className="my-profile-avatar-section">
            <label className="profile-avatar-large" title="Click to change avatar" style={{ cursor: "pointer" }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="avatar-img-large"
                />
              ) : (
                getInitials(user?.username ?? "??")
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
              />
            </label>
            <div className="my-profile-avatar-hint">&gt; CLICK AVATAR TO UPLOAD</div>
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
          <div className="input-group">
            <label className="input-label">&gt; USERNAME (read-only)</label>
            <input
              className="terminal-input"
              type="text"
              disabled
              value={user?.username ?? ""}
            />
          </div>
          <button
            className="connect-btn"
            style={{ marginTop: 0 }}
            onClick={handleSave}
            disabled={saving}
          >
            <span className="btn-text">SAVE PROFILE &gt;&gt;</span>
            <span className="btn-scan" />
          </button>
        </div>
      </div>
    </div>
  );
}
