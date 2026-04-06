import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={cn(
            "px-4 py-2 border cursor-pointer font-mono text-sm max-w-sm",
            "animate-[slideIn_0.2s_ease-out]",
            toast.type === "error" &&
              "bg-terminal-surface border-terminal-red text-terminal-red",
            toast.type === "success" &&
              "bg-terminal-surface border-terminal-green text-terminal-green",
            toast.type === "info" &&
              "bg-terminal-surface border-terminal-amber text-terminal-amber",
          )}
        >
          <span className="text-terminal-text-dim mr-2">
            {toast.type === "error" ? "[ERR]" : toast.type === "success" ? "[OK]" : "[!]"}
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
