import { useState } from "react";
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
      <div className="confirm-dialog persona-dialog">
        <div className="panel-header">
          <span className="panel-title">INVITE AI PERSONA</span>
          <button
            type="button"
            className="modal-close panel-close-btn"
            onClick={onClose}
            aria-label="Close persona dialog"
          >
            ×
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
          <form onSubmit={(e) => void handleSubmit(e)} className="persona-form">
            <div className="persona-form-group">
              <label className="persona-label" htmlFor="persona-name">
                PERSONA NAME
              </label>
              <input
                id="persona-name"
                className="persona-input"
                type="text"
                placeholder="e.g. 叔本华, Newton, 孔子..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="persona-form-group">
              <label className="persona-label" htmlFor="persona-personality">
                PERSONALITY DIRECTIVE <span className="persona-hint">(optional)</span>
              </label>
              <input
                id="persona-personality"
                className="persona-input"
                type="text"
                placeholder="e.g. 辛辣嘲讽的语气, Speak like a pirate..."
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className={`icon-btn confirm-btn confirm-btn-primary persona-submit${loading ? " persona-loading" : ""}`}
              disabled={!name.trim() || loading}
            >
              {loading ? "SUMMONING..." : "INVOKE PERSONA"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
