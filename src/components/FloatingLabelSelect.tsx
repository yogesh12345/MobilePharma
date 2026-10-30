import {
  forwardRef,
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
} from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/react";
import {
  useFloating,
  shift,
  offset,
  flip,
  autoUpdate,
  size,
} from "@floating-ui/react-dom";
import { FloatingPortal } from "@floating-ui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";

interface Option {
  value: string;
  label: string;
}

interface FloatingLabelListboxProps {
  id: string;
  label: string;
  keepOutline?: boolean;
  value: string;
  disabled?: boolean;
  options: Option[];
  selectedDisplayLabel?: string;
  placeholder?: string;
  className?: string;
  portalZIndex?: number;
  onChange: (value: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  isSearchable?: boolean;
  allowCustomValue?: boolean;
  onCustomValueChange?: (value: string) => void;
  labelBgClassName?: string;
  dropdownMinWidthPx?: number;
}

export type FloatingLabelListboxHandle = {
  focus: () => void;
};

const FloatingLabelListbox = forwardRef<
  FloatingLabelListboxHandle,
  FloatingLabelListboxProps
>(
  (
    {
      id,
      label,
      keepOutline = false,
      value,
      disabled,
      options,
      selectedDisplayLabel,
      onChange,
      placeholder = "Select",
      className = "",
      portalZIndex,
      onAddNew,
      addNewLabel,
      isSearchable = false,
      allowCustomValue = false,
      onCustomValueChange,
      labelBgClassName,
      dropdownMinWidthPx,
    },
    ref,
  ) => {
    const selectedOption = options.find((opt) => opt.value === value);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const optionsContainerRef = useRef<HTMLDivElement>(null);
    // const [isFocused, setIsFocused] = useState(false);

    const getZFromClassName = (cls?: string): number | null => {
      if (!cls) return null;
      const mBracket = cls.match(/z-\[(\d+)\]/); // z-[1400]
      if (mBracket) return parseInt(mBracket[1], 10);
      const mSimple = cls.match(/\bz-(\d+)\b/); // z-50, z-10
      if (mSimple) return parseInt(mSimple[1], 10);
      return null;
    };

    // 2) Helper: extract a bg-* class from usage (if present)
    const getBgFromClassName = (cls?: string): string | null => {
      if (!cls) return null;
      // matches bg-white, bg-white/80, bg-blue-200/90, bg-[rgb(...)]
      const m = cls.match(/\bbg-(\[[^\]]+\]|[a-z0-9-]+(?:\/\d{1,3})?)\b/i);
      return m ? `bg-${m[1]}` : null;
    };

    const { refs, floatingStyles, update } = useFloating({
      middleware: [
        offset(4),
        flip(),
        shift(),
        size({
          apply({ rects, elements }) {
            const minWidth = Math.max(0, Number(dropdownMinWidthPx || 0));
            const width = Math.max(rects.reference.width, minWidth);
            elements.floating.style.width = `${width}px`;
          },
        }),
      ],
      whileElementsMounted: autoUpdate,
      placement: "bottom-start",
    });

    const [computedPortalZ, setComputedPortalZ] = useState<number | undefined>(
      portalZIndex,
    );

    // 4) Resolve label background at render time
    const hasLabel = label.trim().length > 0;
    const usageBg = getBgFromClassName(className);
    const resolvedLabelBg =
      labelBgClassName ??
      (usageBg && usageBg !== "bg-transparent"
        ? usageBg
        : "bg-white/80 backdrop-blur-sm");

    useEffect(() => {
      update();
    }, [value, update]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (inputRef.current) {
          inputRef.current.focus();
          return;
        }
        buttonRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (portalZIndex != null) {
        setComputedPortalZ(portalZIndex);
        return;
      }

      const fromClass = getZFromClassName(className);
      if (fromClass != null) {
        setComputedPortalZ(fromClass + 1);
        return;
      }

      // fallback: computed z-index of reference element
      const refEl = refs.reference?.current as HTMLElement | null;
      if (refEl) {
        const zi = window.getComputedStyle(refEl).zIndex;
        const n = Number(zi);
        if (!Number.isNaN(n)) {
          setComputedPortalZ(n + 1);
          return;
        }
      }

      setComputedPortalZ(1001);
    }, [portalZIndex, className, refs.reference]);

    useEffect(() => {
      if (refs.reference.current) {
        refs.setReference(refs.reference.current);
      }
    }, [refs]);

    const filteredOptions = isSearchable || allowCustomValue
      ? options.filter((opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase()),
        )
      : options;

    const mergedOptions = [
      ...filteredOptions,
      ...(onAddNew
        ? [
            {
              value: "__add_new__",
              label: addNewLabel ?? "➕ Add new item",
            },
          ]
        : []),
    ];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const activeEl = document.activeElement as HTMLElement;

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        query.trim() === ""
      ) {
        e.preventDefault();
        onChange("");
        setQuery("");
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const firstOption = optionsContainerRef.current?.querySelector(
          '[role="option"]:not([aria-disabled="true"])',
        ) as HTMLElement;
        firstOption?.focus();
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const focusableItems = Array.from(
          optionsContainerRef.current?.querySelectorAll(
            '[role="option"]:not([aria-disabled="true"])',
          ) || [],
        ) as HTMLElement[];

        const currentIndex = focusableItems.findIndex((el) => el === activeEl);
        if (currentIndex > 0) focusableItems[currentIndex - 1].focus();
      }

      if (e.key === "Enter" && activeEl?.getAttribute("role") === "option") {
        e.preventDefault();
        activeEl.click();
      }
    };

    return (
      <div
        className={`floating-label-group relative ${className}`}
        data-empty-label={!hasLabel && !keepOutline ? "true" : undefined}
      >
        {allowCustomValue ? (
          <Combobox
            value={selectedOption ?? { value, label: selectedDisplayLabel ?? value }}
            disabled={disabled}
            onClose={() => setQuery("")}
            onChange={(option: Option | null) => {
              if (!option) return;
              setQuery("");
              if (option.value === "__add_new__") {
                onAddNew?.();
              } else {
                onChange(option.value);
              }
            }}
          >
            <div
              className="relative"
              ref={(node) => refs.setReference(node)}
            >
              <ComboboxInput
                id={id}
                ref={inputRef}
                displayValue={(option: Option | null) => option?.label ?? ""}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full h-[40px] border border-gray-300 bg-white rounded pl-1 pr-7 text-sm"
                onChange={(event) => {
                  setQuery(event.target.value);
                  onCustomValueChange?.(event.target.value);
                }}
              />
              <ComboboxButton className="absolute inset-y-0 right-0 px-1" aria-label={`Select ${label}`}>
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
              </ComboboxButton>
            </div>
            <FloatingPortal>
              <ComboboxOptions
                ref={(node) => refs.setFloating(node)}
                style={{ ...floatingStyles, zIndex: computedPortalZ }}
                className="max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm empty:invisible"
              >
                {mergedOptions.map((option) => (
                  <ComboboxOption
                    key={option.value}
                    value={option}
                    className={`cursor-pointer select-none py-2 px-4 data-focus:bg-blue-100 data-selected:font-bold ${option.value === "__add_new__" ? "text-blue-600" : "text-gray-700"}`}
                  >
                    {option.label}
                  </ComboboxOption>
                ))}
              </ComboboxOptions>
            </FloatingPortal>
          </Combobox>
        ) : <Listbox
          value={value}
          disabled={disabled}
          onChange={(val) => {
            if (val === "__add_new__") {
              onAddNew?.();
              return;
            }
            onChange(val);
          }}
        >
          {({ open }) => {
            return (
              <div className="relative">
                <ListboxButton
                  id={id}
                  ref={(node) => {
                    refs.setReference(node);
                    buttonRef.current = node;
                  }}
                  // onFocus={() => setIsFocused(true)}
                  // onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Backspace" || e.key === "Delete") &&
                      !open
                    ) {
                      e.preventDefault();
                      onChange("");
                      setQuery("");
                    }
                    if (
                      !open &&
                      e.key.length === 1 &&
                      !e.ctrlKey &&
                      !e.metaKey &&
                      !e.altKey
                    ) {
                      e.preventDefault();
                      const event = new KeyboardEvent("keydown", {
                        key: "ArrowDown",
                        bubbles: true,
                      });
                      e.currentTarget.dispatchEvent(event);
                    }
                  }}
                  className={`listbox-button text-left w-full border border-gray-300 bg-white rounded px-0 py-[2px] text-sm h-[30px] flex items-center ${className} ${
                    !value ? "text-gray-400/50" : "text-black"
                  }`}
                >
                  {(selectedDisplayLabel ?? selectedOption?.label) ||
                    placeholder}
                  <ChevronUpDownIcon className="absolute opacity-10 right-2 h-5 w-5 text-gray-400" />
                </ListboxButton>

                {open && (
                  <FloatingPortal>
                    <ListboxOptions
                      ref={(el) => {
                        refs.setFloating(el);
                        optionsContainerRef.current =
                          el as HTMLDivElement | null;
                        if (el && isSearchable) {
                          window.setTimeout(() => inputRef.current?.focus(), 0);
                        }
                      }}
                      style={{ ...floatingStyles, zIndex: computedPortalZ }}
                      className="max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none text-sm"
                    >
                      {isSearchable && (
                        <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                          <input
                            ref={inputRef}
                            disabled={disabled}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            // onFocus={() => setIsFocused(true)}
                            // onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type to search..."
                            className="w-full box-border bg-white px-2 py-1 text-sm border rounded"
                          />
                        </div>
                      )}

                      {mergedOptions.map((opt) => (
                        <ListboxOption
                          key={opt.value}
                          value={opt.value}
                          disabled={false}
                          as="div"
                          className={({ active, selected }) =>
                            `cursor-pointer select-none py-2 px-4 focus:outline-none focus:bg-blue-100 ${
                              opt.value === "__add_new__"
                                ? "text-blue-600 hover:bg-blue-100"
                                : selected
                                  ? "bg-blue-300 text-blue-900 font-bold"
                                  : "text-gray-700"
                            } ${
                              active && opt.value !== "__add_new__"
                                ? "bg-blue-400 text-black font-bold"
                                : "odd:bg-gray-200/90 even:bg-white/90"
                            }`
                          }
                        >
                          {opt.label}
                        </ListboxOption>
                      ))}

                      {mergedOptions.length === 0 && (
                        <div className="px-4 py-2 text-gray-400">
                          No results found
                        </div>
                      )}
                    </ListboxOptions>
                  </FloatingPortal>
                )}
              </div>
            );
          }}
        </Listbox>}

        {hasLabel && (
          <label
            htmlFor={id}
            className={`pointer-events-none absolute left-4 -top-2 z-[1] px-1 rounded 
              transition-all duration-200 text-sm text-[inherit] ${resolvedLabelBg}`}
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

export default FloatingLabelListbox;
