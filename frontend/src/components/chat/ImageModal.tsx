import { useUiStore } from "@/stores/uiStore";

export function ImageModal() {
  const imageModalUrl = useUiStore((s) => s.imageModalUrl);
  const setImageModal = useUiStore((s) => s.setImageModal);

  if (!imageModalUrl) return null;

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => setImageModal(null)} />
      <div className="modal-content">
        <button className="modal-close" onClick={() => setImageModal(null)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img
          src={imageModalUrl}
          alt="Full size"
          style={{
            maxWidth: "100%",
            maxHeight: "90vh",
            border: "2px solid var(--color-accent)",
            boxShadow: "0 0 30px var(--color-accent)",
          }}
        />
      </div>
    </div>
  );
}
