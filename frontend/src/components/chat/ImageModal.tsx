import { useUiStore } from "@/stores/uiStore";
import { Modal } from "@/components/ui/Modal";

export function ImageModal() {
  const imageModalUrl = useUiStore((s) => s.imageModalUrl);
  const setImageModal = useUiStore((s) => s.setImageModal);

  return (
    <Modal
      open={!!imageModalUrl}
      onClose={() => setImageModal(null)}
      aria-label="Image preview"
    >
      {imageModalUrl && (
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
            id="modal-image"
          />
        </div>
      )}
    </Modal>
  );
}
