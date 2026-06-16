// Durable client-side outbox for workout-set saves. Every edit is written to
// localStorage immediately (so nothing is lost on reload/unmount), then POSTed.
// Failed/offline POSTs stay queued and flush on the next `online` event or
// periodic retry. This is what makes logging reliable on flaky gym signal.
"use client";

export type SetPayload = {
  program: string;
  week: number;
  daySlug: string;
  exerciseSlug: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
};

export type SaveState = "saving" | "saved" | "queued" | "error";

const OUTBOX_KEY = "scorefit.outbox.v1";
const keyOf = (p: SetPayload) =>
  `${p.program}|${p.week}|${p.daySlug}|${p.exerciseSlug}|${p.setIndex}`;

type Outbox = Record<string, SetPayload>;

function read(): Outbox {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "{}") as Outbox;
  } catch {
    return {};
  }
}

function write(o: Outbox) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(o));
  } catch {
    /* storage full / unavailable — best effort */
  }
}

export function pendingCount(): number {
  return Object.keys(read()).length;
}

async function postOne(p: SetPayload): Promise<boolean> {
  try {
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.status === 401) {
      // Session expired — surface to the UI; keep the item queued.
      window.dispatchEvent(new CustomEvent("scorefit-auth-expired"));
      return false;
    }
    return res.ok;
  } catch {
    return false; // network failure
  }
}

/**
 * Persist + attempt to send one set. Reports state via onState. If the POST
 * fails it's left in the outbox and retried later.
 */
export async function saveSet(
  p: SetPayload,
  onState: (key: string, state: SaveState) => void,
): Promise<void> {
  const k = keyOf(p);
  const box = read();
  box[k] = p; // always persist latest value first
  write(box);

  onState(k, navigator.onLine ? "saving" : "queued");
  if (!navigator.onLine) return;

  const ok = await postOne(p);
  if (ok) {
    const cur = read();
    // Only clear if it hasn't been superseded by a newer edit.
    if (cur[k] && JSON.stringify(cur[k]) === JSON.stringify(p)) {
      delete cur[k];
      write(cur);
    }
    onState(k, "saved");
  } else {
    onState(k, navigator.onLine ? "error" : "queued");
  }
}

/** Flush everything queued. Returns the number successfully sent. */
export async function flushOutbox(onState?: (key: string, state: SaveState) => void): Promise<number> {
  if (!navigator.onLine) return 0;
  const box = read();
  let sent = 0;
  for (const [k, p] of Object.entries(box)) {
    onState?.(k, "saving");
    const ok = await postOne(p);
    if (ok) {
      const cur = read();
      if (cur[k] && JSON.stringify(cur[k]) === JSON.stringify(p)) {
        delete cur[k];
        write(cur);
      }
      sent += 1;
      onState?.(k, "saved");
    } else {
      onState?.(k, navigator.onLine ? "error" : "queued");
    }
  }
  return sent;
}

export { keyOf as outboxKey };
