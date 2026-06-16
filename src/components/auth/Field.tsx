"use client";

// Shared labelled input for the auth forms. Uses --color-muted (AA-contrast)
// for the label, and a 16px base font so iOS Safari doesn't force-zoom.
export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
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
  required?: boolean;
  inputMode?: "text" | "numeric" | "email";
  pattern?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
