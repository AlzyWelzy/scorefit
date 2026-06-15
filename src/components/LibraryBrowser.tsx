"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Archetype, Equipment } from "@/lib/movement";

// Cards are rendered on the server and passed in as nodes, so this client
// component never imports the fs-coupled ExerciseImage/customImages modules.
export type CardItem = {
  slug: string;
  archetype: Archetype;
  equipment: Equipment;
  node: React.ReactNode;
};

export function LibraryBrowser({
  cards,
  order,
  equipment,
}: {
  cards: CardItem[];
  order: { key: Archetype; label: string }[];
  equipment: Equipment[];
}) {
  const [pattern, setPattern] = useState<Archetype | "all">("all");
  const [equip, setEquip] = useState<Equipment | "all">("all");

  const filtered = useMemo(
    () =>
      cards.filter(
        (x) => (pattern === "all" || x.archetype === pattern) && (equip === "all" || x.equipment === equip),
      ),
    [cards, pattern, equip],
  );

  const grouped = useMemo(() => {
    const m = new Map<Archetype, CardItem[]>();
    for (const x of filtered) {
      if (!m.has(x.archetype)) m.set(x.archetype, []);
      m.get(x.archetype)!.push(x);
    }
    return m;
  }, [filtered]);

  const active = pattern !== "all" || equip !== "all";

  return (
    <>
      <div className="mt-10 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1.5">pattern</span>
          <Chip active={pattern === "all"} onClick={() => setPattern("all")}>
            All
          </Chip>
          {order.map((o) => (
            <Chip key={o.key} active={pattern === o.key} onClick={() => setPattern(o.key)}>
              {o.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1.5">equipment</span>
          <Chip active={equip === "all"} onClick={() => setEquip("all")}>
            All
          </Chip>
          {equipment.map((e) => (
            <Chip key={e} active={equip === e} onClick={() => setEquip(e)}>
              {e}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span className="num text-sm text-muted">
            {filtered.length} {filtered.length === 1 ? "exercise" : "exercises"}
          </span>
          {active && (
            <button
              onClick={() => {
                setPattern("all");
                setEquip("all");
              }}
              className="inline-flex items-center gap-1 text-xs text-faint hover:text-fg"
            >
              <X className="h-3 w-3" /> clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 rounded-card border border-line bg-surface px-5 py-10 text-center text-muted">
          No exercises match those filters.
        </p>
      ) : (
        <div className="mt-8 space-y-14">
          {order
            .filter((o) => grouped.has(o.key))
            .map((o) => (
              <section key={o.key}>
                <div className="mb-5 flex items-baseline gap-3 border-b border-line pb-2.5">
                  <h2 className="font-display text-xl font-semibold">{o.label}</h2>
                  <span className="num text-sm text-faint">{grouped.get(o.key)!.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {grouped.get(o.key)!.map((c) => (
                    <div key={c.slug} className="sf-rise">
                      {c.node}
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-accent bg-accent-dim text-accent-2" : "border-line text-muted hover:border-line-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
