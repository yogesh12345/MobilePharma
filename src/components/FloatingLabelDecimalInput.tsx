// src/components/FloatingLabelDecimalInput.tsx
import type React from "react";
import { forwardRef, useEffect, useRef, useState } from "react";

interface FloatingLabelDecimalInputProps {
  id: string;
  label: string;
  disabled?: boolean;
  placeholder?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  clampOnBlur?: (value: number) => number;
  clampOnChange?: (value: number) => number;
  minValue?: number;
  showErrorBorder?: boolean;
  onInvalidChange?: (isInvalid: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  labelBgClassName?: string;
  fractionalDigits?: number;
  forceSyncToken?: number | string;
  width?: string; // optional: tailwind width (w-24) or raw CSS (120px)
  autoComplete?: string;
}

const getBgFromClassName = (cls?: string): string | null => {
  if (!cls) return null;
  const m = cls.match(/\bbg-(\[[^\]]+\]|[a-z0-9-]+(?:\/\d{1,3})?)\b/i);
  return m ? `bg-${m[1]}` : null;
};

const FloatingLabelDecimalInput = forwardRef<
  HTMLInputElement,
  FloatingLabelDecimalInputProps
>(
  (
    {
      id,
      label,
      disabled = false,
      placeholder,
      value,
      onChange,
      onBlur,
      clampOnBlur,
      clampOnChange,
      minValue,
      showErrorBorder = false,
      onInvalidChange,
      onKeyDown,
      className = "",
      labelBgClassName,
      fractionalDigits,
      forceSyncToken,
      width,
      autoComplete = "off",
    },
    ref
  ) => {
    const hasLabel = label.trim().length > 0;
    const usageBg = getBgFromClassName(className);
    const resolvedLabelBg =
      labelBgClassName ??
      (usageBg && usageBg !== "bg-transparent"
        ? usageBg
        : "bg-white/80 backdrop-blur-sm");

    const widthIsTW = typeof width === "string" && width.startsWith("w-");
    const widthClass = widthIsTW ? width : "";
    const widthStyle = !widthIsTW && width ? { width } : undefined;

    const formatWithFractionalDigits = (num: number): string => {
      if (fractionalDigits === undefined) return String(num);
      if (Number.isNaN(num)) return "";
      return num.toFixed(fractionalDigits);
    };

    const [text, setText] = useState<string>(() => {
      if (value !== undefined && !Number.isNaN(value)) {
        return formatWithFractionalDigits(value);
      }
      return "";
    });
    const [isFocused, setIsFocused] = useState(false);
    const lastForceSyncTokenRef = useRef<number | string | undefined>(
      forceSyncToken
    );

    const buildNextValue = (
      current: string,
      incoming: string,
      selectionStart: number | null,
      selectionEnd: number | null
    ): string => {
      const start = selectionStart ?? current.length;
      const end = selectionEnd ?? start;
      return current.slice(0, start) + incoming + current.slice(end);
    };

    const isValidNextValue = (nextValue: string): boolean => {
      // allow transitional values while typing
      if (
        nextValue === "" ||
        nextValue === "-" ||
        nextValue === "." ||
        nextValue === "-."
      ) {
        return true;
      }

      // allow only numeric/decimal form
      if (!/^-?\d*(\.\d*)?$/.test(nextValue)) {
        return false;
      }

      // enforce fractional digit cap when configured
      if (fractionalDigits !== undefined) {
        const decimalPoint = nextValue.indexOf(".");
        if (decimalPoint >= 0) {
          const decimalLen = nextValue.length - decimalPoint - 1;
          if (decimalLen > fractionalDigits) {
            return false;
          }
        }
      }

      return true;
    };

    useEffect(() => {
      if (isFocused) return;
      if (value === undefined || Number.isNaN(value)) {
        setText("");
      } else {
        setText(formatWithFractionalDigits(value));
      }
    }, [value, fractionalDigits, isFocused]);

    useEffect(() => {
      const tokenChanged = lastForceSyncTokenRef.current !== forceSyncToken;
      if (!tokenChanged) return;
      lastForceSyncTokenRef.current = forceSyncToken;
      if (value === undefined || Number.isNaN(value)) {
        setText("");
      } else {
        setText(formatWithFractionalDigits(value));
      }
    }, [forceSyncToken, value, fractionalDigits]);

    const parsed = parseFloat(text);
    const isInvalid =
      minValue !== undefined && !Number.isNaN(parsed) && parsed < minValue;

    const onInvalidChangeRef = useRef(onInvalidChange);
    useEffect(() => {
      onInvalidChangeRef.current = onInvalidChange;
    }, [onInvalidChange]);

    useEffect(() => {
      onInvalidChangeRef.current?.(isInvalid);
    }, [isInvalid]);

    return (
      <div
        className={`floating-label-group justify-center relative inline-block ${widthClass}`}
        data-empty-label={hasLabel ? undefined : "true"}
        style={widthStyle}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={text}
          onFocus={() => setIsFocused(true)}
          onBeforeInput={(e: React.FormEvent<HTMLInputElement> | InputEvent) => {
            const target = e.currentTarget as HTMLInputElement;
            const inputEvent = e as InputEvent;
            const nextValue = buildNextValue(
              target.value,
              inputEvent.data ?? "",
              target.selectionStart,
              target.selectionEnd
            );
            if (!isValidNextValue(nextValue)) {
              e.preventDefault();
            }
          }}
          onPaste={(e) => {
            const target = e.currentTarget;
            const pasted = e.clipboardData.getData("text");
            const nextValue = buildNextValue(
              target.value,
              pasted,
              target.selectionStart,
              target.selectionEnd
            );
            if (!isValidNextValue(nextValue)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);

            const num = parseFloat(raw);
            if (Number.isNaN(num)) {
              onChange(0);
              return;
            }

            const nextValue = clampOnChange ? clampOnChange(num) : num;
            onChange(nextValue);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            const num = parseFloat(e.currentTarget.value);
            if (Number.isNaN(num)) {
              setText("");
              onChange(0);
              onBlur?.(e);
              return;
            }

            const clamped = clampOnBlur ? clampOnBlur(num) : num;
            const normalized = formatWithFractionalDigits(clamped);
            setText(normalized);
            onChange(clamped);
            onBlur?.(e);
          }}
          onKeyDown={onKeyDown}
          className={
            showErrorBorder && isInvalid
              ? `${className} border-red-500`
              : className
          }
          ref={ref}
          onWheel={(evt) => (evt.currentTarget as HTMLInputElement).blur()}
        />

        {hasLabel && (
          <label
            htmlFor={id}
            className={`pointer-events-none absolute left-3 -top-3 z-[1] px-1 rounded transition-all duration-200 text-sm text-right ${resolvedLabelBg}`}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

export default FloatingLabelDecimalInput;
