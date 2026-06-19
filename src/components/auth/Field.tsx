"use client";

import { useId } from "react";

// Shared labelled input for the auth forms. Uses --color-muted (AA-contrast)
// for the label, and a 16px base font so iOS Safari doesn't force-zoom.
export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  required = true,
  inputMode,
  pattern,
  maxLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  inputMode?: "text" | "numeric" | "email";
  pattern?: string;
  maxLength?: number;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Link the input to whichever helper text is present, so a screen reader announces
  // it with the field. Error takes precedence and also flips aria-invalid.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-base text-fg shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_0_0_3px_color-mix(in_srgb,var(--color-accent)_22%,transparent)] focus:outline-none"
      />
      {error ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-hard">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="mt-1 block text-xs text-muted">
            {hint}
          </span>
        )
      )}
    </label>
  );
}
