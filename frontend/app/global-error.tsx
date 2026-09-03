"use client";

// F-01: global error boundary — before this, any render error white-screened
// the app with no recovery path (there was no error.tsx anywhere).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
            An unexpected error occurred. Please try again — if it persists,
            contact support{error.digest ? ` (ref: ${error.digest})` : ""}.
          </p>
          <button
            onClick={reset}
            style={{
              margin: "0 auto",
              padding: "0.6rem 1.5rem",
              borderRadius: "0.5rem",
              background: "#1e3a5f",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
