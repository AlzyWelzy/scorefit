// Lightweight entrance wrappers. Pure CSS (see .sf-rise in globals.css) so
// content is ALWAYS visible on load — never gated on JS/intersection — while
// still getting a tasteful fade + rise. Respects prefers-reduced-motion.

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`sf-rise ${className}`} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}

export function RevealGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function RevealItem({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`sf-rise ${className}`} style={style}>
      {children}
    </div>
  );
}
