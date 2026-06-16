"use client";

import { Search } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function SearchTrigger() {
  // Detect macOS on the client without a hydration flash: SSR and the first
  // hydration render use the server snapshot (⌘), then React re-renders with the
  // real value. Using a store (vs. an effect) keeps render the single source.
  const mac = useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/i.test(navigator.platform),
    () => true,
  );
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="group inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-faint transition-colors hover:border-line-2 hover:text-muted"
      aria-label="Search (open with Command or Control K)"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Search…</span>
      <kbd className="hidden rounded border border-line-2 px-1.5 py-0.5 font-mono text-[10px] lg:inline">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
