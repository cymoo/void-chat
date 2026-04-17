import {
  useState,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  useRole,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
} from "@floating-ui/react";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger element — must accept a ref */
  children: ReactElement;
  /** The floating content */
  content: ReactNode;
  /** Preferred placement (default: "bottom") */
  placement?: Placement;
  /** Offset from the trigger in px (default: 8) */
  offsetPx?: number;
  /** Extra class for the floating container */
  className?: string;
  /** Whether to manage focus inside the popover (default: true) */
  modal?: boolean;
}

export function Popover({
  open,
  onOpenChange,
  children,
  content,
  placement = "bottom",
  offsetPx = 8,
  className,
  modal = false,
}: PopoverProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement,
    middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  // Clone the child to attach the ref and interaction props
  const triggerElement = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })
    : children;

  return (
    <>
      {triggerElement}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={modal} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={`popover-content ${className ?? ""}`}
              {...getFloatingProps()}
            >
              {content}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

/* ── Uncontrolled convenience wrapper ── */

interface UncontrolledPopoverProps extends Omit<PopoverProps, "open" | "onOpenChange"> {
  defaultOpen?: boolean;
}

export function UncontrolledPopover({
  defaultOpen = false,
  ...rest
}: UncontrolledPopoverProps) {
  const [open, setOpen] = useState(defaultOpen);
  return <Popover open={open} onOpenChange={setOpen} {...rest} />;
}
