import { useUiStore } from "@/stores/uiStore";

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
