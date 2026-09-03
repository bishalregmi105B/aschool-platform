// F-01: dashboard loading skeleton — navigation used to show a blank flash.

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse h-8 w-1/3 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="animate-pulse h-64 bg-muted rounded-xl" />
    </div>
  );
}
