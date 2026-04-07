import { useUiStore } from "@/stores/uiStore";

export function ConfirmDialog() {
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const resolveConfirm = useUiStore((s) => s.resolveConfirm);

  if (!confirmDialog) return null;

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => resolveConfirm(false)} />
      <div className="confirm-dialog">
        <div className="panel-header">
          <span className="panel-title">{confirmDialog.title}</span>
          <button
            type="button"
            className="modal-close panel-close-btn"
            onClick={() => resolveConfirm(false)}
            aria-label="Close confirmation dialog"
          >
            ×
          </button>
        </div>
        <div className="confirm-body">
          <p className="confirm-message">{confirmDialog.message}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="icon-btn confirm-btn"
              onClick={() => resolveConfirm(false)}
            >
              {confirmDialog.cancelText}
            </button>
            <button
              type="button"
              className={`icon-btn confirm-btn ${confirmDialog.tone === "danger" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
              onClick={() => resolveConfirm(true)}
            >
              {confirmDialog.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
