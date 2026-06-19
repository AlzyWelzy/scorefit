"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-2 hover:text-fg focus-visible:border-accent focus-visible:text-fg print:hidden"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
