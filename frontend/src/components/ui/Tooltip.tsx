import {
  useState,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useInteractions,
  useRole,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";

interface TooltipProps {
  /** The content shown in the tooltip */
  content: ReactNode;
  /** The element to attach the tooltip to — must accept a ref */
  children: ReactElement;
  /** Preferred placement (default: "top") */
  placement?: Placement;
  /** Delay before showing in ms (default: 400) */
  showDelay?: number;
  /** Delay before hiding in ms (default: 0) */
  hideDelay?: number;
  /** Offset from the trigger in px (default: 6) */
  offsetPx?: number;
  /** Extra class for the tooltip container */
  className?: string;
  /** Disable the tooltip */
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  placement = "top",
  showDelay = 400,
  hideDelay = 0,
  offsetPx = 6,
  className,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: open && !disabled,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    delay: { open: showDelay, close: hideDelay },
    move: false,
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  const triggerElement = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })
    : children;

  return (
    <>
      {triggerElement}
      {open && !disabled && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={`tooltip ${className ?? ""}`}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
