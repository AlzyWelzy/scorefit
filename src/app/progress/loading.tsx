export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="space-y-4">
        <div className="shimmer h-8 w-48 rounded-lg bg-surface-2" />
        <div className="shimmer h-32 w-full rounded-card bg-surface-2" />
        <div className="shimmer h-24 w-full rounded-card bg-surface-2" />
        <div className="shimmer h-24 w-full rounded-card bg-surface-2" />
      </div>
    </div>
  );
}
