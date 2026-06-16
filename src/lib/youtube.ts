// YouTube helpers shared across exercise media components.
export function videoId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

export type ThumbQuality = "mq" | "hq" | "sd";
// mqdefault 320x180 (~8KB) · hqdefault 480x360 · sddefault 640x480.
// Served directly from i.ytimg.com (a fast global CDN) — no optimizer hop.
export function thumbUrl(url?: string | null, q: ThumbQuality = "mq"): string | null {
  const id = videoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/${q}default.jpg` : null;
}
