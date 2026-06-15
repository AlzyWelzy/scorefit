"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { videoId } from "@/lib/youtube";

export function YouTubeFacade({ url, title }: { url?: string | null; title: string }) {
  const [active, setActive] = useState(false);
  const id = videoId(url);
  if (!id) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-card border border-line bg-surface-2">
      {active ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`${title} — demo`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={`Play ${title} demo video`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt={`${title} demonstration`}
            decoding="async"
            className="media-treat absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-bg/10 to-transparent" />
          <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-bg shadow-[0_8px_30px_rgba(255,106,61,0.35)] transition-transform group-hover:scale-110">
            <Play className="ml-1 h-7 w-7" fill="currentColor" />
          </span>
          <span className="num absolute bottom-3 left-3 z-10 rounded bg-bg/80 px-2 py-1 text-xs text-muted backdrop-blur">
            Demo · YouTube
          </span>
        </button>
      )}
    </div>
  );
}
