import {
  useState,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  useRole,
  useListNavigation,
  useTypeahead,
  offset,
  flip,
  shift,
  size,
  autoUpdate,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
} from "@floating-ui/react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Placeholder when no value is selected */
  placeholder?: string;
  /** Preferred placement (default: "bottom-start") */
  placement?: Placement;
  /** Extra class for the trigger button */
  className?: string;
  /** Extra class for the dropdown menu */
  menuClassName?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Accessible label */
  "aria-label"?: string;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  placement = "bottom-start",
  className,
  menuClassName,
  disabled = false,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : null;
  });

  const listRef = useRef<(HTMLElement | null)[]>([]);
  const labelsRef = useRef<(string | null)[]>(
    options.map((o) => (typeof o.label === "string" ? o.label : null)),
  );

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    selectedIndex,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex,
    onMatch: setActiveIndex,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNav,
    typeahead,
  ]);

  const handleSelect = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && !option.disabled) {
        setSelectedIndex(index);
        onChange(option.value);
        setOpen(false);
      }
    },
    [options, onChange],
  );

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : placeholder;
  }, [options, value, placeholder]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={`select-trigger ${className ?? ""}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        {...getReferenceProps()}
      >
        <span className="select-value">{selectedLabel}</span>
        <span className={`select-chevron ${open ? "select-chevron-open" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={`select-menu ${menuClassName ?? ""}`}
              {...getFloatingProps()}
            >
              {options.map((option, i) => (
                <div
                  key={option.value}
                  ref={(node) => { listRef.current[i] = node; }}
                  role="option"
                  tabIndex={i === activeIndex ? 0 : -1}
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  className={[
                    "select-option",
                    option.value === value ? "select-option-selected" : "",
                    i === activeIndex ? "select-option-active" : "",
                    option.disabled ? "select-option-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  {...getItemProps({
                    onClick: () => handleSelect(i),
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(i);
                      }
                    },
                  })}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
