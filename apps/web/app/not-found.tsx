import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell">
      <div className="fail-page">
        <h1>Page not found</h1>
        <p className="muted">That route is not in PrintCast.</p>
        <Link className="btn" href="/">Back to dashboard</Link>
      </div>
    </main>
  );
}
