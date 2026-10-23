"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell">
      <div className="fail-page">
        <h1>Something went wrong</h1>
        <p className="muted">The page could not be shown. Try again.</p>
        <button className="retry" type="button" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
