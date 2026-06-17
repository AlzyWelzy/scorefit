"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * Detect the browser's IANA timezone once per load and persist it to the user when
 * it differs from what's stored, then refresh the session so server-side session/
 * streak date-bucketing uses the real local day instead of the UTC default.
 * Renders nothing; no-op until authenticated. Best-effort — failures retry next load.
 */
export function TimezoneSync() {
  const { data: session, status, update } = useSession();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || status !== "authenticated" || !session?.user) return;

    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      handled.current = true;
      return;
    }
    if (!tz || tz === session.user.timezone) {
      handled.current = true;
      return;
    }

    handled.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz }),
        });
        if (res.ok) await update();
      } catch {
        // Offline / transient — re-attempted on the next load.
        handled.current = false;
      }
    })();
  }, [session, status, update]);

  return null;
}
