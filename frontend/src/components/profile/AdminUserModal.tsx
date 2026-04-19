import { useState, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import type { PersonaConfig, User } from "@/api/types";

interface Props {
  user: User;
  personaConfig?: PersonaConfig;
  onClose: () => void;
  onSaved: (updatedUser: User, updatedConfig?: PersonaConfig) => void;
}

export function AdminUserModal({ user, personaConfig, onClose, onSaved }: Props) {
  const addToast = useUiStore((s) => s.addToast);
  const isBot = user.role === "bot";

  // Regular user fields
  const [username, setUsername] = useState(user.username);
  const [status, setStatus] = useState(user.status ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Bot-specific fields (from persona config)
  const [displayName, setDisplayName] = useState(personaConfig?.displayName ?? "");
  const [personaBio, setPersonaBio] = useState(personaConfig?.bio ?? "");
  const [personality, setPersonality] = useState(personaConfig?.personality ?? "");
  const [systemPrompt, setSystemPrompt] = useState(personaConfig?.systemPrompt ?? "");

  const [saving, setSaving] = useState(false);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const result = await api.uploadImage(file);
      if (result.url) {
        const updated = await api.updateAdminUserProfile(user.id, { avatarUrl: result.url });
        setAvatarUrl(result.url);
        addToast("Avatar updated", "success");
        onSaved(updated);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Avatar upload failed", "error");
    } finally {
      setAvatarUploading(false);
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isBot) {
        const updatedConfig = await api.updateAdminPersona(user.id, {
          displayName: displayName || undefined,
          bio: personaBio || undefined,
          personality: personality || undefined,
          systemPrompt: systemPrompt || undefined,
        });
        addToast("Persona updated", "success");
        onSaved(user, updatedConfig);
      } else {
        const trimmed = username.trim();
        if (!trimmed) {
          addToast("Username is required", "error");
          return;
        }
        const updatedUser = await api.updateAdminUserProfile(user.id, {
          username: trimmed,
          status: status || undefined,
          bio: bio || undefined,
        });
        addToast("Profile updated", "success");
        onSaved(updatedUser);
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const title = isBot
    ? `PERSONA — ${personaConfig?.displayName ?? user.username}`
    : `USER — ${user.username}`;

  return (
    <Modal open onClose={onClose} aria-label="Edit user">
      <div className="my-profile-panel">
        <div className="panel-header">
          <span className="panel-title">{title}</span>
          <button className="modal-close panel-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="my-profile-content">
          <div className="my-profile-avatar-section">
            <label className="profile-avatar-large" title="Click to change avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || user.username} loading="lazy" className="avatar-img-large" />
              ) : isBot ? (
                <span style={{ fontSize: "2rem" }}>🤖</span>
              ) : (
                getInitials(user.username)
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

          {isBot ? (
            <>
              <div className="input-group">
                <label className="input-label">&gt; DISPLAY NAME</label>
                <input
                  className="terminal-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">&gt; BIO</label>
                <textarea
                  className="terminal-input terminal-textarea"
                  rows={2}
                  value={personaBio}
                  onChange={(e) => setPersonaBio(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">&gt; PERSONALITY</label>
                <input
                  className="terminal-input"
                  type="text"
                  placeholder="e.g. concise, analytical, friendly"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">&gt; SYSTEM PROMPT (blank = keep existing)</label>
                <textarea
                  className="terminal-input terminal-textarea"
                  rows={4}
                  placeholder="Leave blank to keep the existing system prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="input-group">
                <label className="input-label">&gt; USERNAME</label>
                <input
                  className="terminal-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">&gt; STATUS</label>
                <input
                  className="terminal-input"
                  type="text"
                  placeholder="What's on their mind?"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">&gt; BIO</label>
                <textarea
                  className="terminal-input terminal-textarea"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="my-profile-footer">
          <button className="connect-btn" onClick={handleSave} disabled={saving}>
            <span className="btn-text">{saving ? "SAVING..." : "SAVE >>"}</span>
            <span className="btn-scan" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
