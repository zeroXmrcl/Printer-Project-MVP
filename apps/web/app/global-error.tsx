"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
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
