import { getExercise } from "@/lib/data";
import type { FeedItem } from "@/db/social";

// Human-readable, system-generated line per event kind (never free text). Shared by the
// feed page (SSR first page) and /api/feed (load-more), so the wording stays identical.
export function describeFeedItem(item: Pick<FeedItem, "kind" | "data">): string {
  const d = item.data ?? {};
  switch (item.kind) {
    case "e1rm_pr": {
      const name = getExercise(String(d.exerciseSlug))?.name ?? String(d.exerciseSlug ?? "a lift");
      return `hit a new best on ${name} — e1RM ${d.e1rm ?? "?"}`;
    }
    case "achievement":
      return `unlocked “${d.title ?? "an achievement"}”`;
    case "streak_milestone":
      return `reached a ${d.weeks ?? ""}-week streak`;
    case "program_completed": {
      const prog = d.program === "beginner" ? "Beginner" : d.program === "intermediate" ? "Int/Adv" : null;
      return prog ? `completed the ${prog} block` : `completed a training block`;
    }
    case "session_completed":
      return `trained`;
    default:
      return "did something";
  }
}
