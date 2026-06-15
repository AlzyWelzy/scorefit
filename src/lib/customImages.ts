import fs from "fs";
import path from "path";

// Optional override: drop a file at public/exercises/<slug>.(jpg|webp|png|avif)
// and it will be used as that exercise's image instead of the demo still.
let map: Map<string, string> | null = null;

export function customImage(slug: string): string | null {
  if (!map) {
    map = new Map();
    try {
      const dir = path.join(process.cwd(), "public", "exercises");
      for (const f of fs.readdirSync(dir)) {
        const base = f.replace(/\.(jpe?g|png|webp|avif)$/i, "");
        if (base !== f) map.set(base, `/exercises/${f}`);
      }
    } catch {
      /* directory may not exist yet — that's fine */
    }
  }
  return map.get(slug) ?? null;
}
