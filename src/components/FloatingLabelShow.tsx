// src/components/FloatingLabelShow2.tsx
import { forwardRef } from "react";

type FormatKind =
  | "auto" // infer from value *type* only (no string->number coercion)
  | "text"
  | "integer"
  | "number"
  | "decimal"
  | "currency"
  | "percent"
  | "date"
  | "time"
  | "datetime";

interface FloatingLabelShowProps {
  id: string;
  label: string;
  value?: string | number | Date | null;

  // Formatting controls
  formatKind?: FormatKind; // default: "auto"
  locale?: string; // default: "en-IN"
  currency?: string; // e.g. "INR", "USD" (when formatKind="currency")
  pattern?: string; // date tokens: dd, MM, yyyy, HH, mm, ss
  numberOptions?: Intl.NumberFormatOptions; // extra number options to merge
  dateOptions?: Intl.DateTimeFormatOptions; // extra date options to merge
  formatter?: (v: any) => string; // final override formatter

  // Back-compat knobs
  placeholder?: string;
  /** Defaults to true so it never focuses and looks exactly like a disabled input */
  disabled?: boolean;
  autoComplete?: string;
  className?: string; // e.g. "border rounded px-3 py-2 h-10 bg-white w-full"
  labelBgClassName?: string; // optional override for the label pill bg
  containerClassName?: string;
  width?: string;
  fractionalDigits?: number; // still supported for numbers/decimal
  focusable?: boolean;
}

// Same bg extractor used in FloatingLabelInput
const getBgFromClassName = (cls?: string): string | null => {
  if (!cls) return null;
  const m = cls.match(/\bbg-(\[[^\]]+\]|[a-z0-9-]+(?:\/\d{1,3})?)\b/i);
  return m ? `bg-${m[1]}` : null;
};

const getWidthFromClassName = (cls?: string): string | null => {
  if (!cls) return null;
  const m = cls.match(/\bw-(full)\b/i);
  return m ? `w-${m[1]}` : null;
};

// helpers
const isFiniteNumber = (v: any) => typeof v === "number" && Number.isFinite(v);

const toNumber = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (isFiniteNumber(v)) return v as number;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toDate = (v: any): Date | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

// Very small pattern formatter for common tokens
// Supports: dd, MM, yyyy, HH, mm, ss
const formatDatePattern = (d: Date, pattern: string) => {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const map: Record<string, string> = {
    dd: pad(d.getDate()),
    MM: pad(d.getMonth() + 1),
    yyyy: String(d.getFullYear()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  };
  return pattern.replace(/yyyy|dd|MM|HH|mm|ss/g, (t) => map[t] ?? t);
};

const DEFAULT_TZ = "Asia/Kolkata";

const FloatingLabelShow = forwardRef<HTMLInputElement, FloatingLabelShowProps>(
  (
    {
      id,
      label,
      value,

      // NEW defaults
      formatKind = "auto",
      locale = "en-IN",
      currency,
      pattern,
      numberOptions,
      dateOptions,
      formatter,

      // legacy/back-compat props
      placeholder,
      disabled = true, // ⬅️ default disabled
      autoComplete = "off",
      className = "",
      labelBgClassName,
      containerClassName = "",
      width,
      fractionalDigits,
      focusable = false,
    },
    ref
  ) => {
    // Determine effective kind:
    //  - "auto" uses *runtime type* only. We do NOT coerce strings to numbers,
    //    so "00123" stays text and keeps leading zeros.
    const effectiveKind: FormatKind = (() => {
      if (formatKind !== "auto") return formatKind;
      if (value instanceof Date) return "datetime";
      if (typeof value === "number" && Number.isFinite(value)) {
        return Number.isInteger(value) ? "integer" : "decimal";
      }
      return "text";
    })();

    const formatNumber = (num: number): string => {
      const merged: Intl.NumberFormatOptions = {};

      // Only clamp to 0 when caller didn't ask for specific decimals
      if (effectiveKind === "integer" && fractionalDigits == null) {
        merged.maximumFractionDigits = 0;
      }

      // currency / percent styles
      if (effectiveKind === "percent") {
        merged.style = "percent";
      }
      if (effectiveKind === "currency" && currency) {
        merged.style = "currency";
        merged.currency = currency;
        merged.currencyDisplay = "symbol";
      }

      // Caller-supplied extra number options next (may override the above)
      Object.assign(merged, numberOptions);

      // Finally, if fractionalDigits is provided, force both min & max to it
      if (fractionalDigits != null) {
        merged.minimumFractionDigits = fractionalDigits;
        merged.maximumFractionDigits = fractionalDigits;
      }

      // Last-resort guard: keep options consistent if someone passed conflicting values
      if (
        merged.minimumFractionDigits != null &&
        merged.maximumFractionDigits != null &&
        (merged.maximumFractionDigits as number) <
          (merged.minimumFractionDigits as number)
      ) {
        merged.maximumFractionDigits = merged.minimumFractionDigits;
      }

      return new Intl.NumberFormat(locale, merged).format(num);
    };

    const formatDate = (dt: Date): string => {
      if (pattern) return formatDatePattern(dt, pattern);
      const base: Intl.DateTimeFormatOptions =
        effectiveKind === "date"
          ? { dateStyle: "medium" }
          : effectiveKind === "time"
          ? { timeStyle: "medium", hour12: false }
          : { dateStyle: "medium", timeStyle: "medium", hour12: false }; // datetime

      // Stabilize timezone unless caller overrides
      const merged: Intl.DateTimeFormatOptions = {
        timeZone: DEFAULT_TZ,
        ...base,
        ...(dateOptions ?? {}),
      };

      // If caller explicitly provided a timeZone, respect it
      if (dateOptions && "timeZone" in dateOptions!) {
        merged.timeZone = dateOptions.timeZone!;
      }

      return new Intl.DateTimeFormat(locale, merged).format(dt);
    };

    const computeText = (): string => {
      if (value === null || value === undefined || value === "") return "";
      if (typeof formatter === "function") {
        try {
          const out = formatter(value);
          if (typeof out === "string") return out;
        } catch {
          /* ignore and fallback */
        }
      }

      switch (effectiveKind) {
        case "integer":
        case "number":
        case "decimal":
        case "currency":
        case "percent": {
          const n = toNumber(value);
          if (n === null) return String(value ?? "");
          return formatNumber(n);
        }
        case "date":
        case "time":
        case "datetime": {
          const d = toDate(value);
          if (!d) return String(value ?? "");
          return formatDate(d);
        }
        case "text":
        default: {
          // Preserve older behavior when fractionalDigits was passed
          const n = typeof value === "number" ? value : null;
          if (n !== null && fractionalDigits != null) {
            return new Intl.NumberFormat(locale, {
              minimumFractionDigits: fractionalDigits,
              maximumFractionDigits: fractionalDigits,
              ...numberOptions,
            }).format(n);
          }
          return String(value ?? "");
        }
      }
    };

    const text = computeText();

    const hasLabel = label.trim().length > 0;
    const usageBg = getBgFromClassName(className);
    const resolvedLabelBg =
      labelBgClassName ??
      (usageBg && usageBg !== "bg-transparent"
        ? usageBg
        : "bg-white/80 backdrop-blur-sm");

    // Allow Tailwind width utilities OR raw CSS width values
    const widthIsTW = typeof width === "string" && width.startsWith("w-");
    const inheritedWidthClass = !width ? getWidthFromClassName(className) : "";
    const widthClass = widthIsTW ? width : inheritedWidthClass || "";
    const widthStyle = !widthIsTW && width ? { width } : undefined;

    const inputDisabled = focusable ? false : disabled;

    return (
      <div
        className={`floating-label-group relative inline-block align-middle ${widthClass} ${containerClassName}`}
        data-empty-label={hasLabel ? undefined : "true"}
        style={widthStyle}
      >
        {/* Disabled input to match FloatingLabelInput exactly */}
        <input
          ref={ref}
          id={id}
          type="text"
          autoComplete={autoComplete}
          disabled={inputDisabled}
          readOnly={!inputDisabled}
          placeholder={placeholder}
          value={text}
          onChange={() => {
            /* no-op: read-only */
          }}
          tabIndex={focusable ? 0 : -1}
          aria-disabled={inputDisabled ? "true" : "false"}
          className={`block w-full ${className}`}
        />
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
  }
);

export default FloatingLabelShow;
