import { useState, type FormEvent } from "react";
import { useRoomStore } from "@/stores/roomStore";
import { useUiStore } from "@/stores/uiStore";

export function CreateRoomDialog() {
  const open = useUiStore((s) => s.createRoomOpen);
  const setOpen = useUiStore((s) => s.setCreateRoomOpen);
  const createRoom = useRoomStore((s) => s.createRoom);
  const addToast = useUiStore((s) => s.addToast);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Room name is required", "error");
      return;
    }
    if (isPrivate && !password) {
      addToast("Private rooms require a password", "error");
      return;
    }

    setSubmitting(true);
    try {
      await createRoom({
        name: name.trim(),
        description: description.trim() || null,
        isPrivate,
        password: isPrivate ? password : null,
      });
      addToast(`Room "${name}" created`, "success");
      setName("");
      setDescription("");
      setIsPrivate(false);
      setPassword("");
      setOpen(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-terminal-surface border border-terminal-border p-6 max-w-md w-full mx-4">
        <div className="text-terminal-green text-sm mb-4 font-bold">
          ┌── CREATE NEW ROOM ──┐
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-terminal-green text-xs mb-1">
              ROOM NAME:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
              placeholder="enter room name..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-terminal-green text-xs mb-1">
              DESCRIPTION (OPTIONAL):
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
              placeholder="describe your room..."
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-4 h-4 border text-xs flex items-center justify-center ${
                isPrivate
                  ? "border-terminal-amber text-terminal-amber"
                  : "border-terminal-border text-transparent"
              }`}
            >
              ×
            </button>
            <label
              onClick={() => setIsPrivate(!isPrivate)}
              className="text-terminal-text text-sm cursor-pointer"
            >
              PRIVATE ROOM (password required)
            </label>
          </div>

          {isPrivate && (
            <div>
              <label className="block text-terminal-amber text-xs mb-1">
                ROOM PASSWORD:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-amber focus:outline-none"
                placeholder="enter password..."
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 border border-terminal-green text-terminal-green px-3 py-2 text-sm hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
            >
              {submitting ? "CREATING..." : "[ CREATE ]"}
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
