// src/components/FloatingLabelDateInput.tsx
import React, { useEffect, useRef, useState } from "react";

interface FloatingLabelDateInputProps {
  id: string;
  label: string;
  disabled?: boolean;
  autoComplete?: string;
  value: Date | undefined;
  maxDate?: Date;
  placeholder?: string; // defaults to dd-mm-yyyy
  dateSeparator?: "-" | "/";
  onChange: (value: Date | undefined) => void;
  onBlur?: (value: Date | undefined) => void;
  className?: string; // keep your original styles here
  labelBgClassName?: string;
  openCalendarSignal?: number;
}

/* ===== Helpers (non-visual) ===== */
const toISO = (d: Date): string => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const toDisplay = (d: Date, separator = "-"): string => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return [day, m, y].join(separator);
};
const dateOnly = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const resolveMaxDate = (maxDate?: Date): Date => {
  const today = dateOnly(new Date());
  if (!maxDate) return today;
  const max = dateOnly(maxDate);
  return max < today ? max : today;
};
const currentCenturyBase = (): number =>
  Math.floor(new Date().getFullYear() / 100) * 100;
const twoDigitYearToFull = (yy: string): number =>
  currentCenturyBase() + Number(yy);
const pad2 = (n: string): string => String(n).padStart(2, "0");
const onlyDigits = (s: string): string => s.replace(/\D/g, "");
const cleanDateInput = (s: string): string => {
  // allow digits and common separators; collapse repeated separators
  const cleaned = s.replace(/[^0-9./-]/g, "");
  return cleaned.replace(/[./-]{2,}/g, (m) => m[0]).slice(0, 10);
};
// ddmmyyyy | ddmmyy
// dd-mm-yyyy | dd/mm/yyyy | dd.mm.yyyy | dd-mm-yy | dd/mm/yy | dd.mm.yy
// dd-mm (uses existing year) | dd (uses existing month/year) -> ISO, else null
const normalizeToISO = (raw: string, baseDate?: Date): string | null => {
  if (!raw) return null;
  const s = raw.trim();
  const digits = onlyDigits(s);
  if (digits.length === 8) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }
  if (digits.length === 6) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yy = digits.slice(4, 6);
    return `${twoDigitYearToFull(yy)}-${mm}-${dd}`;
  }
  let m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{2})$/.exec(s);
  if (m) return `${twoDigitYearToFull(m[3])}-${pad2(m[2])}-${pad2(m[1])}`;
  m = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  if (baseDate) {
    if (digits.length === 4) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      return `${baseDate.getFullYear()}-${mm}-${dd}`;
    }
    if (digits.length === 2) {
      const dd = digits.slice(0, 2);
      return `${baseDate.getFullYear()}-${pad2(
        String(baseDate.getMonth() + 1),
      )}-${dd}`;
    }
    m = /^(\d{1,2})\D+(\d{1,2})$/.exec(s);
    if (m) {
      return `${baseDate.getFullYear()}-${pad2(m[2])}-${pad2(m[1])}`;
    }
    m = /^(\d{1,2})$/.exec(s);
    if (m) {
      return `${baseDate.getFullYear()}-${pad2(
        String(baseDate.getMonth() + 1),
      )}-${pad2(m[1])}`;
    }
  }
  return null;
};
const isCompleteDateInput = (raw: string): boolean => {
  const s = raw.trim();
  const digits = onlyDigits(s);
  if (digits.length === 6 || digits.length === 8) return true;
  return /^(\d{1,2}\D+\d{1,2}\D+\d{2}|\d{1,2}\D+\d{1,2}\D+\d{4}|\d{4}\D+\d{1,2}\D+\d{1,2})$/.test(
    s,
  );
};
// derive label bg from input className (same as your earlier file)
const getBgFromClassName = (cls?: string): string | null => {
  if (!cls) return null;
  const m = cls.match(/\bbg-(\[[^\]]+\]|[a-z0-9-]+(?:\/\d{1,3})?)\b/i);
  return m ? `bg-${m[1]}` : null;
};

const FloatingLabelDateInput: React.FC<FloatingLabelDateInputProps> = ({
  id,
  label,
  placeholder,
  dateSeparator = "-",
  value,
  maxDate,
  onChange,
  onBlur,
  className = "",
  disabled = false,
  autoComplete = "off",
  labelBgClassName,
  openCalendarSignal,
}) => {
  // ---- label bg logic kept identical to your earlier version ----
  const hasLabel = label.trim().length > 0;
  const usageBg = getBgFromClassName(className);
  const resolvedLabelBg =
    labelBgClassName ??
    (usageBg && usageBg !== "bg-transparent"
      ? usageBg
      : "bg-white/80 backdrop-blur-sm");

  // ---- local buffer to allow free typing without resets ----
  const [raw, setRaw] = useState<string>(value ? toDisplay(value, dateSeparator) : "");
  const [isDirty, setDirty] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  // Hidden native <input type="date"> to show calendar
  const dateRef = useRef<HTMLInputElement | null>(null);

  // keep text in sync with external value unless mid-typing
  useEffect(() => {
    if (!isDirty) setRaw(value ? toDisplay(value, dateSeparator) : "");
  }, [value, isDirty, dateSeparator]);

  const commitIfValid = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(undefined);
      setRaw("");
      setDirty(false);
      return true;
    }
    const iso = normalizeToISO(trimmed, value);
    if (!iso) return false;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    const max = resolveMaxDate(maxDate);
    const next = dateOnly(d);
    if (next > max) return false;
    onChange(next);
    setRaw(toDisplay(next, dateSeparator));
    setDirty(false);
    return true;
  };

  const positionHiddenPicker = () => {
    if (!wrapperRef.current || !dateRef.current) return;
    if (typeof window === "undefined") return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const pickerWidth = 320;
    const pickerHeight = 340;
    const pad = 8;
    const maxLeft = Math.max(pad, window.innerWidth - pickerWidth - pad);
    const desiredLeft = rect.left;
    const left = Math.max(pad, Math.min(desiredLeft, maxLeft));
    const maxTop = Math.max(pad, window.innerHeight - pickerHeight - pad);
    const desiredTop = rect.bottom;
    const top = Math.max(pad, Math.min(desiredTop, maxTop));
    Object.assign(dateRef.current.style, {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: "1px",
      height: "1px",
    });
  };

  const openCalendar = () => {
    if (!dateRef.current || disabled) return;
    positionHiddenPicker();
    // prevent input blur; open native picker when available
    // @ts-ignore
    if (dateRef.current.showPicker) dateRef.current.showPicker();
    else dateRef.current.focus();
  };

  useEffect(() => {
    if (openCalendarSignal == null || disabled) return;
    textInputRef.current?.focus();
    textInputRef.current?.select();
    window.setTimeout(() => openCalendar(), 0);
  }, [disabled, openCalendarSignal]);

  return (
    <div
      ref={wrapperRef}
      className="floating-label-group relative"
      data-empty-label={hasLabel ? undefined : "true"}
    >
      {/* Visible text input — same classes control border/height/radius */}
      <input
        ref={textInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder ?? ["dd", "mm", "yyyy"].join(dateSeparator)}
        value={raw}
        onChange={(e) => {
          const next = e.target.value;
          setDirty(true);
          const cleaned = cleanDateInput(next);
          setRaw(cleaned);
          if (isCompleteDateInput(cleaned)) commitIfValid(cleaned);
        }}
        onBlur={() => {
          if (!commitIfValid(raw)) {
            setRaw(value ? toDisplay(value, dateSeparator) : "");
            setDirty(false);
            onBlur?.(value);
            return;
          }
          if (!raw.trim()) {
            onBlur?.(undefined);
            return;
          }
          const nextIso = normalizeToISO(raw.trim(), value);
          const nextValue =
            nextIso && !Number.isNaN(new Date(nextIso).getTime())
              ? dateOnly(new Date(nextIso))
              : value;
          onBlur?.(nextValue);
        }}
        className={className}
      />

      {/* Calendar icon INSIDE the input (right edge), no bg/border to preserve style */}
      <button
        type="button"
        aria-label="Open calendar"
        title="Open calendar"
        onMouseDown={(e) => e.preventDefault()} // keep focus, avoid premature blur
        onClick={openCalendar}
        disabled={disabled}
        className={`absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5
                    flex items-center justify-center
                    ${
                      disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-80"
                    }`}
        style={{ lineHeight: 1 }}
      >
        <span aria-hidden>📅</span>
      </button>

      {/* Hidden native date input that powers the calendar picker */}
      <input
        ref={dateRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="absolute opacity-0 pointer-events-none -z-10"
        disabled={disabled}
        max={toISO(resolveMaxDate(maxDate))}
        value={value ? toISO(value) : ""}
        onChange={(e) => {
          const iso = e.target.value;
          if (!iso) {
            onChange(undefined);
            setRaw("");
            setDirty(false);
            return;
          }
          const d = new Date(iso);
          if (!isNaN(d.getTime())) {
            const max = resolveMaxDate(maxDate);
            const next = dateOnly(d);
            if (next <= max) {
              onChange(next);
              setRaw(toDisplay(next, dateSeparator));
              setDirty(false);
            }
          }
        }}
      />

      {/* Floating label — identical placement & style to your earlier file */}
      {hasLabel && (
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-3 -top-3 z-[1] px-1 rounded
                    transition-all duration-200 text-sm text-[inherit] ${resolvedLabelBg}`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default FloatingLabelDateInput;
