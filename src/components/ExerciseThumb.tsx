import Image from "next/image";
import { thumbUrl } from "@/lib/youtube";

function initials(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Real exercise imagery from the demo video thumbnail. Falls back to a clean
// monogram tile if a video id can't be resolved.
export function ExerciseThumb({
  name,
  demo,
  sizes = "(max-width: 768px) 50vw, 240px",
}: {
  name: string;
  demo?: string | null;
  sizes?: string;
}) {
  const src = thumbUrl(demo);

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2">
        <span className="tabular text-2xl font-semibold text-faint">{initials(name)}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`${name} demo`}
      fill
      sizes={sizes}
      className="object-cover"
    />
  );
}
