"use client";

// F-01: route-segment error boundary with the app's chrome still intact.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="win11 min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center"
      style={{ background: "var(--w11-window-bg)" }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{
          background: "var(--w11-accent-light)",
          borderRadius: "var(--w11-radius-full)",
        }}
      >
        ⚠️
      </div>
      <h1
        className="text-xl font-semibold"
        style={{ color: "var(--w11-text-primary)" }}
      >
        Something went wrong
      </h1>
      <p
        className="text-sm max-w-md"
        style={{ color: "var(--w11-text-secondary)" }}
      >
        An unexpected error occurred while loading this page. Please try
        again{error.digest ? ` (ref: ${error.digest})` : ""}.
      </p>
      <button onClick={reset} className="win11-btn accent">
        Try again
      </button>
    </div>
  );
}
