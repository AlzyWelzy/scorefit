"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Dumbbell, CalendarDays, BookOpen, LayoutGrid, CornerDownLeft } from "lucide-react";
import type { SearchEntry, SearchKind } from "@/lib/searchIndex";

const KIND_ICON: Record<SearchKind, typeof Search> = {
  Exercise: Dumbbell,
  Week: CalendarDays,
  Program: LayoutGrid,
  Guide: BookOpen,
};

const KIND_ORDER: SearchKind[] = ["Exercise", "Week", "Program", "Guide"];

/** Cheap ranked match: startsWith > word-boundary > substring. -1 = no match. */
function score(entry: SearchEntry, q: string): number {
  if (!q) return 0;
  const t = entry.terms;
  const title = entry.title.toLowerCase();
  if (title.startsWith(q)) return 100;
  if (t.includes(` ${q}`)) return 60;
  if (t.includes(q)) return 30;
  // token-AND: every query word appears somewhere
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => t.includes(w))) return 20;
  return -1;
}

export function CommandPalette({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = !query
      ? // default: a few of each kind so the palette isn't empty
        index.slice(0, 8)
      : index
          .map((e) => ({ e, s: score(e, query) }))
          .filter((x) => x.s >= 0)
          .sort((a, b) => b.s - a.s || a.e.title.localeCompare(b.e.title))
          .slice(0, 40)
          .map((x) => x.e);
    // Order by display group (KIND_ORDER) so the flat index used by arrow-key
    // navigation + aria-activedescendant matches the visually grouped list.
    // Array.sort is stable, so the score order is preserved within each kind.
    return [...base].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  }, [q, index]);

  // index lookup by entry id (perf + correctness vs results.indexOf)
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    results.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }, []);

  const go = useCallback(
    (entry?: SearchEntry) => {
      const target = entry ?? results[active];
      if (!target) return;
      close();
      router.push(target.href);
    },
    [results, active, close, router],
  );

  // Global open: ⌘K / Ctrl+K, and a custom event for the header button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) {
      // remember what had focus so we can restore it on close
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      // Reset the selection and focus the input when the palette enters — an
      // intentional "on open" side-effect tied to focus management.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(0);
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // keep active item in view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search ScoreFit"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={close} />
      <div className="glass-strong ring-accent relative w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go();
              } else if (e.key === "Tab") {
                // Trap focus in the dialog: navigation is via arrows +
                // aria-activedescendant, so keep focus on the input rather than
                // letting Tab escape to the page behind the modal.
                e.preventDefault();
              }
            }}
            placeholder="Search exercises, weeks, guide…"
            className="w-full bg-transparent py-4 text-[15px] text-fg placeholder:text-faint focus:outline-none"
            aria-label="Search query"
            role="combobox"
            aria-expanded={true}
            aria-controls="cmdk-list"
            aria-activedescendant={results.length ? `cmdk-opt-${active}` : undefined}
          />
          <kbd className="hidden shrink-0 rounded border border-line-2 px-1.5 py-0.5 text-[10px] text-faint sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} id="cmdk-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No matches for “{q}”.</p>
          ) : (
            KIND_ORDER.map((kind) => {
              const group = results.filter((r) => r.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} className="mb-1">
                  <p className="eyebrow px-4 py-1.5 text-faint">{kind}</p>
                  {group.map((r) => {
                    const idx = indexById.get(r.id) ?? 0;
                    const Icon = KIND_ICON[r.kind];
                    const isActive = idx === active;
                    return (
                      <button
                        key={r.id}
                        id={`cmdk-opt-${idx}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isActive}
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => go(r)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? "bg-linear-to-r from-accent/12 to-transparent text-fg ring-accent" : "hover:bg-surface/60"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-faint"}`} />
                        <span className="flex-1 truncate text-sm text-fg">{r.title}</span>
                        <span className="shrink-0 text-xs text-muted">{r.subtitle}</span>
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
