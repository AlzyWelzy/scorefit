import Link from "next/link";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="2" y="20" width="5" height="10" rx="1.4" fill="var(--color-faint)" />
      <rect x="9.5" y="14.5" width="5" height="15.5" rx="1.4" fill="var(--color-muted)" />
      <rect x="17" y="9" width="5" height="21" rx="1.4" fill="var(--color-accent-2)" />
      <rect x="24.5" y="3" width="5" height="27" rx="1.4" fill="var(--color-accent)" />
      <path
        d="M1 12 L7 12 L10 6 L14 17 L18 9 L22 13 L31 13"
        stroke="var(--color-data)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="ScoreFit home">
      <LogoMark size={size} />
      <span
        className="font-display font-bold tracking-tight text-fg"
        style={{ fontSize: size * 0.64 }}
      >
        Score<span className="gradient-text">Fit</span>
      </span>
    </Link>
  );
}
