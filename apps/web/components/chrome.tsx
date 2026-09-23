import Link from "next/link";

export function SiteHeader({ title, notes, current }: { title: string; notes: string; current: "live" | "prints" | "energy" | "admin" }) {
  return (
    <header className="mast">
      <div className="brand">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="6" width="24" height="3" fill="#f4f4f5" />
          <rect x="7" y="12" width="18" height="3" fill="#a1a1aa" />
          <rect x="10" y="18" width="12" height="3" fill="#71717a" />
          <rect x="13" y="24" width="6" height="3" fill="#3f3f46" />
        </svg>
        <span>
          {title || "PrintCast"}
          {notes ? <small>{notes}</small> : null}
        </span>
      </div>
      <nav className="nav">
        <Link href="/" aria-current={current === "live" ? "page" : undefined}>Dashboard</Link>
        <Link href="/prints" aria-current={current === "prints" ? "page" : undefined}>Prints</Link>
        <Link href="/energy" aria-current={current === "energy" ? "page" : undefined}>Energy</Link>
        <Link href="/admin" aria-current={current === "admin" ? "page" : undefined}>Settings</Link>
      </nav>
    </header>
  );
}
