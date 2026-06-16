// Guards against open-redirect: only allow same-origin, app-internal paths.
// Rejects absolute URLs (http://evil), protocol-relative (//evil), and
// backslash-normalised forms (/\evil, \\evil) that some browsers treat as
// protocol-relative. Anything suspicious falls back to `fallback`.
export function safeInternalPath(value: unknown, fallback = "/log"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  // Must start with a single forward slash and not look protocol-relative.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;
  // Defence in depth: reject control chars and whitespace that could be used
  // to smuggle a scheme past the checks above.
  if (/[\x00-\x1f\s]/.test(value)) return fallback;
  return value;
}
