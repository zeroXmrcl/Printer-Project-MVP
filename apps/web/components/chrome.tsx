import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({
  title,
  notes,
  current,
  action,
}: {
  title: string;
  notes: string;
  current: "live" | "prints" | "energy" | "admin";
  action?: ReactNode;
}) {
  return (
    <header className="mast">
      <Link className="brand" href="/">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="6" width="24" height="3" fill="currentColor" />
          <rect x="7" y="12" width="18" height="3" fill="currentColor" opacity="0.72" />
          <rect x="10" y="18" width="12" height="3" fill="currentColor" opacity="0.48" />
          <rect x="13" y="24" width="6" height="3" fill="currentColor" opacity="0.28" />
        </svg>
        <span>
          {title || "PrintCast"}
          {notes ? <small>{notes}</small> : null}
        </span>
      </Link>
      <div className="mast-tools">
        <nav className="nav" aria-label="Studio">
          <Link href="/" aria-current={current === "live" ? "page" : undefined}>Dashboard</Link>
          <Link href="/prints" aria-current={current === "prints" ? "page" : undefined}>Prints</Link>
          <Link href="/energy" aria-current={current === "energy" ? "page" : undefined}>Energy</Link>
          <Link href="/admin" aria-current={current === "admin" ? "page" : undefined}>Settings</Link>
        </nav>
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
