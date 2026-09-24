"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell">
      <h1>Something went wrong</h1>
      <p className="muted">The page could not be shown. Try again.</p>
      <button type="button" onClick={() => reset()}>Try again</button>
    </main>
  );
}
