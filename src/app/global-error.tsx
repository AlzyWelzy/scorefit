"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(60% 60% at 50% 30%, rgba(255,106,61,0.12), transparent 70%), #07090c",
          color: "#f2f5f7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: "26rem",
            borderRadius: "1rem",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(20,24,30,0.6)",
            backdropFilter: "blur(16px) saturate(140%)",
            WebkitBackdropFilter: "blur(16px) saturate(140%)",
            boxShadow:
              "0 24px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "2.5rem 2rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#9ba4ad", marginTop: "0.5rem" }}>
            An unexpected error occurred. Please reload the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              border: "none",
              borderRadius: "0.625rem",
              background: "linear-gradient(180deg, #ff7a4d, #ff5a2d)",
              color: "#07090c",
              padding: "0.625rem 1.5rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 24px -6px rgba(255,106,61,0.5)",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
