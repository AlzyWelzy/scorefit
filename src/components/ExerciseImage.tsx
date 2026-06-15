import { Dumbbell } from "lucide-react";
import { thumbUrl, type ThumbQuality } from "@/lib/youtube";
import { customImage } from "@/lib/customImages";

// Real exercise imagery with a unifying duotone-ish treatment. Custom file at
// public/exercises/<slug>.* wins; otherwise the demo still, loaded directly
// from the CDN (no optimizer hop), lazy by default.
export function ExerciseImage({
  slug,
  demo,
  name,
  className = "",
  rounded = "rounded-lg",
  quality = "mq",
  eager = false,
  treat = true,
}: {
  slug: string;
  demo?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  quality?: ThumbQuality;
  eager?: boolean;
  treat?: boolean;
}) {
  const src = customImage(slug) ?? thumbUrl(demo, quality);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 ${rounded} ${className}`}>
        <Dumbbell className="h-1/3 w-1/3 text-faint" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        className={`absolute inset-0 h-full w-full object-cover ${treat ? "media-treat" : ""}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/55 via-transparent to-transparent" />
    </div>
  );
}
