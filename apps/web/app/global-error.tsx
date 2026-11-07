"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          :root { color-scheme: dark; }
          @media (prefers-color-scheme: light) { :root { color-scheme: light; } }
          body { margin: 0; min-height: 100%; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
          main { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 48px 0 72px; }
          h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; }
          p { font-size: 15px; }
          button { min-height: 44px; margin-top: 8px; padding: 8px 16px; border-radius: 6px; font: inherit; cursor: pointer; }
          @media (prefers-color-scheme: dark) {
            body { background: #101010; color: #f4f4f5; }
            p { color: #a1a1aa; }
            button { border: 1px solid #3f3f46; background: #181818; color: #f4f4f5; }
          }
          @media (prefers-color-scheme: light) {
            body { background: #f4f4f5; color: #18181b; }
            p { color: #52525b; }
            button { border: 1px solid #d4d4d8; background: #fff; color: #18181b; }
          }
        `}</style>
      </head>
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>The page could not be shown. Try again.</p>
          <button type="button" onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
