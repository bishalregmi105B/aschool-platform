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
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-3xl">
        ⚠️
      </div>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        An unexpected error occurred while loading this page. Please try
        again{error.digest ? ` (ref: ${error.digest})` : ""}.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
