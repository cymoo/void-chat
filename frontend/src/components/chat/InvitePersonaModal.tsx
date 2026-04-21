import { useState } from "react";
import { X } from "lucide-react";
import { invitePersona } from "@/api/client";
import { useUiStore } from "@/stores/uiStore";
import { Modal } from "@/components/ui/Modal";

interface InvitePersonaModalProps {
  roomId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvitePersonaModal({ roomId, onClose, onSuccess }: InvitePersonaModalProps) {
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ displayName: string; bio: string } | null>(null);
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await invitePersona(roomId, {
        name: name.trim(),
        personality: personality.trim() || null,
      });
      if (res.success) {
        setResult({
          displayName: res.displayName ?? name,
          bio: res.bio ?? "",
        });
        addToast(`${res.displayName ?? name} has joined the room`, "success");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        addToast(res.error ?? `Unable to recognize "${name}" as a known persona`, "error");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to invite persona", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="my-profile-panel persona-dialog">
        <div className="panel-header">
          <span className="panel-title">INVITE AI PERSONA</span>
          <button
            type="button"
            className="modal-close panel-close-btn"
            onClick={onClose}
            aria-label="Close persona dialog"
          >
            <X size={20} />
          </button>
        </div>

        {result ? (
          <div className="persona-result">
            <div className="persona-result-icon">🤖</div>
            <div className="persona-result-name">{result.displayName}</div>
            <div className="persona-result-bio">{result.bio}</div>
            <div className="persona-result-status">Joined the room!</div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="my-profile-content">
            <div className="input-group">
              <label className="input-label" htmlFor="persona-name">
                &gt; PERSONA NAME
              </label>
              <input
                id="persona-name"
                className="terminal-input"
                type="text"
                placeholder="e.g. Schopenhauer, Newton, Confucius..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="persona-personality">
                &gt; PERSONALITY DIRECTIVE <span className="persona-hint">(optional)</span>
              </label>
              <input
                id="persona-personality"
                className="terminal-input"
                type="text"
                placeholder="e.g. Speak like a pirate, cynical and sharp-tongued..."
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="connect-btn"
              disabled={!name.trim() || loading}
            >
              <span className="btn-text">{loading ? "SUMMONING..." : "INVOKE PERSONA >>"}</span>
              <span className="btn-scan" />
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
