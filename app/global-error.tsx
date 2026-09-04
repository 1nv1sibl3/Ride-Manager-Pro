"use client";

// Replaces the entire document, so it renders its own <html>/<body> and
// cannot rely on globals.css being loaded.
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "18px" }}>Something went wrong</h1>
        <p style={{ color: "#666", fontSize: "14px" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
