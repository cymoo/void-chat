import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";

export function ProfileModal() {
  const open = useUiStore((s) => s.profileOpen);
  const setOpen = useUiStore((s) => s.setProfileOpen);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const addToast = useUiStore((s) => s.addToast);

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const [saving, setSaving] = useState(false);

  if (!open || !user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        avatarUrl: avatarUrl || null,
        bio: bio || null,
        status: status || null,
      });
      updateUser(updated);
      addToast("Profile updated", "success");
      setOpen(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-terminal-surface border border-terminal-border p-6 max-w-md w-full mx-4">
        <div className="text-terminal-green text-sm mb-4 font-bold">
          ┌── EDIT PROFILE ──┐
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-terminal-green text-xs mb-1">
              AVATAR URL:
            </label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-terminal-green text-xs mb-1">
              BIO:
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none resize-none"
              placeholder="tell us about yourself..."
            />
          </div>

          <div>
            <label className="block text-terminal-green text-xs mb-1">
              STATUS:
            </label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
              placeholder="what are you up to..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 border border-terminal-green text-terminal-green px-3 py-2 text-sm hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
            >
              {saving ? "SAVING..." : "[ SAVE ]"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 border border-terminal-border text-terminal-text-dim px-3 py-2 text-sm hover:border-terminal-red hover:text-terminal-red transition-colors"
            >
              [ CANCEL ]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
