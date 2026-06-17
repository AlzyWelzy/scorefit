// Timezone-aware calendar-date helpers. Sessions, streaks, and weekly windows all
// bucket by the user's LOCAL date, derived server-side from their stored IANA
// timezone — never from a client-supplied date — so a 9pm-Pacific log doesn't roll
// into "tomorrow" in UTC and can't be backdated by lying about the clock.

/**
 * The local calendar date (YYYY-MM-DD) at instant `at` in IANA timezone `tz`.
 * Falls back to the UTC date if `tz` is missing or invalid.
 */
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
