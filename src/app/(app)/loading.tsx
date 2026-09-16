export default function AppLoading() {
  return (
    <div
      aria-label="กำลังโหลด"
      aria-busy="true"
      className="animate-pulse space-y-4 pt-3"
    >
      <div className="h-8 w-40 rounded-control bg-surface-muted" />
      <div className="h-40 rounded-card bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-card bg-surface" />
        <div className="h-28 rounded-card bg-surface" />
      </div>
      <div className="h-48 rounded-card bg-surface" />
    </div>
  );
}
