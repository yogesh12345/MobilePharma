// src/components/GenericAutoCompleteExtended.tsx
import React, {
  useMemo,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import GenericAutoComplete from "./GenericAutoComplete";

type AutoCompleteItem = {
  id: number | string;
  label1: string;
  label2?: string;
  label3?: string;
  label4?: string;
  label5?: string;
  PaymentMode?: string;
  paymentMode?: string;
};

type BaseProps = React.ComponentProps<typeof GenericAutoComplete>;

type ExtraProps = {
  /** Build the info lines shown in the textarea (maxLines applied after). */
  buildInfoLines?: (item: AutoCompleteItem) => string[];
  /** Maximum number of lines to render in the textarea. Default: 4 */
  maxLines?: number;
  /** Extra class for the textarea. */
  textareaClassName?: string;
  /** If true (default), textarea is hidden when empty. */
  hideWhenEmpty?: boolean;
  /** If true, we keep details visible even when user edits the query after selection. Default: true */
  persistAfterSelectionEdit?: boolean;
  renderMode?: string;
  detailsText?: string;
  onDetailsVisibleChange?: (visible: boolean) => void; // N
};

export type GenericAutoCompleteExtendedProps = Omit<BaseProps, "onSelect"> &
  ExtraProps & {
    /** onSelect from parent still receives the selected item */
    onSelect: (item: AutoCompleteItem) => void;
  };

const GenericAutoCompleteExtended = forwardRef<
  HTMLInputElement,
  GenericAutoCompleteExtendedProps
>(
  (
    {
      onSelect,
      buildInfoLines,
      maxLines = 4,
      textareaClassName,
      hideWhenEmpty = true,
      persistAfterSelectionEdit = true,
      renderMode = "overlay",
      onDetailsVisibleChange,
      searchQuery,
      setSearchQuery,
      detailsText,
      ...rest
    },
    ref
  ) => {
    const [selected, setSelected] = useState<AutoCompleteItem | null>(null);
    const [lockedInfo, setLockedInfo] = useState<string>("");

    // Expose the inner input ref without causing render loops
    const innerRefEl = useRef<HTMLInputElement | null>(null);
    const setInnerRefEl = useCallback((el: HTMLInputElement | null) => {
      if (innerRefEl.current !== el) innerRefEl.current = el;
    }, []);
    useImperativeHandle(ref, () => innerRefEl.current as HTMLInputElement);

    // Default info builder: label2..label5 as lines (e.g., Address lines)
    const defaultBuilder = (item: AutoCompleteItem) =>
      [item.label2, item.label3, item.label4, item.label5].filter(
        Boolean
      ) as string[];

    const infoText = useMemo(() => {
      const src = selected ? (buildInfoLines ?? defaultBuilder)(selected) : [];
      const lines = src.slice(0, maxLines);
      return lines.join("\n").trim();
    }, [selected, buildInfoLines, maxLines]);

    // Lock the info text on selection so it survives typing unless disabled.
    useEffect(() => {
      if (selected) setLockedInfo(infoText);
    }, [selected, infoText]);

    // Clear info when query fully cleared (fresh start)
    useEffect(() => {
      if (!persistAfterSelectionEdit && selected) {
        setSelected(null);
        setLockedInfo("");
      } else if (searchQuery.trim() === "") {
        setSelected(null);
        setLockedInfo("");
      }
    }, [searchQuery, persistAfterSelectionEdit]);

    const handleSelect = (item: AutoCompleteItem) => {
      setSelected(item);
      onSelect(item); // still inform parent
    };

    // compute internal text from selection as before...
    const textFromSelection = (
      persistAfterSelectionEdit ? lockedInfo || infoText : infoText
    ).trim();

    // parent wins if provided
    const parentDetails = String(detailsText ?? "").trim();

    // ⬇ final text preferred order: parent-controlled > internal computed
    // const textToShow = String(detailsText ?? "").trim() || textFromSelection;
    // const textToShow = (
    //       persistAfterSelectionEdit ? lockedInfo || infoText : infoText
    //     ).trim();

    // FINAL text to show
    const textToShow = parentDetails || textFromSelection;

    // NEW: only show when input has text
    const hasQuery = (searchQuery ?? "").trim().length > 0;

    const visible = hasQuery && textToShow !== "";
    const [prevVisible, setPrevVisible] = useState(false);

    useEffect(() => {
      if (visible !== prevVisible) {
        setPrevVisible(visible);
        onDetailsVisibleChange?.(visible);
      }
    }, [visible, prevVisible, onDetailsVisibleChange]);

    const rows =
      textToShow.length === 0
        ? 1
        : Math.max(1, Math.min(maxLines, textToShow.split(/\r?\n/).length));
    const hasTopLabel =
      !rest.hideFloatingLabel &&
      String(rest.topLabel ?? "Search Entry").trim().length > 0;
    const disableOutline = Boolean(rest.disableOutline);
    const transparentBackground = Boolean(rest.transparentBackground);

    return (
      <div
        className="w-full relative"
        data-empty-label={hasTopLabel ? undefined : "true"}
        data-disable-outline={disableOutline ? "true" : undefined}
        data-transparent-background={
          transparentBackground ? "true" : undefined
        }
      >
        <GenericAutoComplete
          ref={setInnerRefEl}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelect={handleSelect}
          {...rest}
        />

        {/* --- details (overlay; does not change layout) --- */}
        <textarea
          readOnly
          tabIndex={-1}
          value={textToShow}
          rows={rows}
          style={{
            // 🔑 hide if empty OR if input itself is empty
            display: hideWhenEmpty && !visible ? "none" : "block",
          }}
          className={[
            "resize-none rounded border border-gray-300 bg-gray-50 p-2 text-sm leading-5 shadow",
            "pointer-events-auto", // read-only; ignore clicks
            renderMode === "inline"
              ? "static mt-1 w-full min-w-0 max-h-none overflow-visible shadow-none"
              : "absolute left-0 right-0 top-[calc(100%+2px)] z-20 max-h-32 overflow-auto",
            textareaClassName ?? "",
          ].join(" ")}
        />
      </div>
    );
  }
);

export default GenericAutoCompleteExtended;
