import {
  type ReactNode,
} from "react";
import {
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingOverlay,
  FloatingFocusManager,
  FloatingPortal,
} from "@floating-ui/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra class applied to the content wrapper */
  className?: string;
  /** Extra class applied to the overlay/backdrop */
  overlayClassName?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** Lock scrolling on body when open (default: true) */
  lockScroll?: boolean;
  /** ARIA label for the dialog */
  "aria-label"?: string;
  /** ARIA labelledby for the dialog */
  "aria-labelledby"?: string;
  /** Initial focus ref — pass a ref to the element that should receive focus on open */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function Modal({
  open,
  onClose,
  children,
  className,
  overlayClassName,
  closeOnBackdrop = true,
  closeOnEscape = true,
  lockScroll = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  initialFocusRef,
}: ModalProps) {
  const { refs, context } = useFloating({
    open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    escapeKey: closeOnEscape,
    outsidePressEvent: "mousedown",
    enabled: closeOnBackdrop || closeOnEscape,
    outsidePress: closeOnBackdrop,
  });
  const role = useRole(context, { role: "dialog" });

  const { getFloatingProps } = useInteractions([click, dismiss, role]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <FloatingOverlay
        lockScroll={lockScroll}
        className={`modal-overlay ${overlayClassName ?? ""}`}
      >
        <FloatingFocusManager
          context={context}
          initialFocus={initialFocusRef}
        >
          <div
            ref={refs.setFloating}
            className={`modal-container ${className ?? ""}`}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            {...getFloatingProps()}
          >
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}

/* ── Lightweight hook for imperative confirm dialogs ── */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
}

/**
 * Re-export the existing confirm mechanism from uiStore.
 * The ConfirmDialog component itself is refactored to use <Modal>.
 */
export type { ConfirmOptions };
