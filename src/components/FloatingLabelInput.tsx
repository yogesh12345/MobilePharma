// src/components/FloatingLabelInput.tsx
import React, { forwardRef } from "react";

interface FloatingLabelInputProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void; // supported
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; // NEW
  disabled?: boolean;
  type?: string;
  autoComplete?: string;
  accessKey?: string;
  ariaKeyShortcuts?: string;
  title?: string;
  className?: string;
  labelBgClassName?: string;
}

// Reuse bg extraction pattern (matches bg-white, bg-white/80, bg-blue-200/90, bg-[...])
const getBgFromClassName = (cls?: string): string | null => {
  if (!cls) return null;
  const m = cls.match(/\bbg-(\[[^\]]+\]|[a-z0-9-]+(?:\/\d{1,3})?)\b/i);
  return m ? `bg-${m[1]}` : null;
};

const FloatingLabelInput = forwardRef<
  HTMLInputElement,
  FloatingLabelInputProps
>(
  (
    {
      id,
      label,
      value,
      placeholder,
      required,
      inputMode,
      maxLength,
      onChange,
      onFocus,
      onBlur,
      onKeyDown, // NEW
      disabled,
      type = "text",
      autoComplete = "off",
      accessKey,
      ariaKeyShortcuts,
      title,
      className = "",
      labelBgClassName,
    },
    ref
  ) => {
    const usageBg = getBgFromClassName(className);
    const resolvedLabelBg =
      labelBgClassName ??
      (usageBg && usageBg !== "bg-transparent"
        ? usageBg
        : "bg-white/80 backdrop-blur-sm");

    return (
      <div className="floating-label-group">
        <input
          ref={ref}
          id={id}
          type={type}
          autoComplete={autoComplete}
          accessKey={accessKey}
          aria-keyshortcuts={ariaKeyShortcuts}
          title={title}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown} // NEW
          className={className}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-3 -top-3 z-[1] px-1 rounded
                      transition-all duration-200 text-sm text-[inherit] ${resolvedLabelBg}`}
        >
          {label}
        </label>
      </div>
    );
  }
);

export default FloatingLabelInput;
