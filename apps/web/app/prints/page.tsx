import Link from "next/link";
import { formatDuration } from "@printcast/contracts";
import { SiteHeader } from "../../components/chrome";
import { jobs, settings } from "../../lib/store";

export const dynamic = "force-dynamic";

export default function PrintsPage() {
  const display = settings();
  const rows = jobs().filter((job) => job.closedAt !== null);
  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="prints" />
      <div className="section-label">Prints</div>
      <section className="widget pad">
        {rows.length === 0 ? <p className="muted">No finished prints yet.</p> : (
          <table className="table">
            <thead><tr><th>File</th><th>Result</th><th className="num">When</th><th className="num">Time</th><th className="num">%</th></tr></thead>
            <tbody>
              {rows.map((job) => {
                const width = job.lastPercent === null ? 0 : Math.max(0, Math.min(100, job.lastPercent));
                return (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/prints/${job.id}`}>{job.filename ?? "Untitled"}</Link>
                      <div className="mini"><i style={{ width: `${width}%` }} /></div>
                    </td>
                    <td>{title(job.result)}</td>
                    <td className="num">{when(job.closedAt ?? job.openedAt)}</td>
                    <td className="num">{formatDuration(job.openedAt, job.closedAt ?? Date.now())}</td>
                    <td className="num">{job.lastPercent === null ? "—" : Math.round(job.lastPercent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function title(value: string): string {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : "—";
}

function when(epoch: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(epoch));
}
