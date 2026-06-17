// Timezone-aware calendar-date helpers. Sessions, streaks, and weekly windows all
// bucket by the user's LOCAL date, derived server-side from their stored IANA
// timezone — never from a client-supplied date — so a 9pm-Pacific log doesn't roll
// into "tomorrow" in UTC and can't be backdated by lying about the clock.

/**
 * The local calendar date (YYYY-MM-DD) at instant `at` in IANA timezone `tz`.
 * Falls back to the UTC date if `tz` is missing or invalid.
 */
// A workout's calendar date is frozen from when the set was RECORDED on the client
// (loggedAt), not when a flaky-signal flush reaches the server. We clamp the client
// instant server-side to resist backdating/clock-spoofing: at most this far in the
// past, and a little skew into the future.
const MAX_BACKDATE_MS = 48 * 60 * 60 * 1000;
const MAX_SKEW_MS = 5 * 60 * 1000;

/** The user-local YYYY-MM-DD derived from a (clamped) client record-time, else now. */
export function resolveLocalDate(tz: string | undefined, loggedAt?: string): string {
  const zone = tz || "UTC";
  const now = Date.now();
  let at = now;
  if (loggedAt) {
    const parsed = Date.parse(loggedAt);
    if (!Number.isNaN(parsed)) {
      at = Math.min(Math.max(parsed, now - MAX_BACKDATE_MS), now + MAX_SKEW_MS);
    }
  }
  return localDateInTz(zone, new Date(at));
}

/** True if `tz` is a valid IANA timezone identifier (e.g. "America/Los_Angeles"). */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localDateInTz(tz: string, at: Date = new Date()): string {
  try {
    // en-CA renders as ISO-style YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  }
}
