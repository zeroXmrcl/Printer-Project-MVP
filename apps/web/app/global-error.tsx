"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100%", background: "#100f0d", color: "#f3eee6", fontFamily: "IBM Plex Sans, Segoe UI, sans-serif" }}>
        <main style={{ width: "min(1180px, calc(100% - 48px))", margin: "0 auto", padding: "48px 0 72px" }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>Something went wrong</h1>
          <p style={{ color: "#b7aea3", fontSize: 15 }}>The page could not be shown. Try again.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: 44, marginTop: 8, padding: "8px 16px", border: "1px solid #4a443c", borderRadius: 6, background: "#1a1815", color: "#f3eee6" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
