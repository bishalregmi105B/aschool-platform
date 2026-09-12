// F-01: dashboard loading skeleton — navigation used to show a blank flash.

export default function DashboardLoading() {
  return (
    <div
      className="win11 p-6 space-y-4"
      style={{ background: "var(--w11-window-bg)" }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="animate-pulse h-8 w-1/3 rounded-lg"
        style={{ background: "var(--w11-control-hover)" }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse h-24 rounded-xl"
            style={{
              background: "var(--w11-card-bg)",
              boxShadow: "var(--w11-elevation-card)",
            }}
          />
        ))}
      </div>
      <div
        className="animate-pulse h-64 rounded-xl"
        style={{
          background: "var(--w11-card-bg)",
          boxShadow: "var(--w11-elevation-card)",
        }}
      />
    </div>
  );
}
