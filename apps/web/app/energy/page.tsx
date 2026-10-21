import { integrateWh } from "@printcast/contracts";
import { SiteHeader } from "../../components/chrome";
import { EnergyBoard } from "../../components/energy-board";
import { dashboard, jobs, samples, settings } from "../../lib/store";

export const dynamic = "force-dynamic";

export default function EnergyPage() {
  const display = settings();
  const now = Date.now();
  const rows = jobs().map((job) => ({
    job,
    wh: integrateWh(samples(job.id).map((sample) => ({ at: sample.at, watts: sample.watts })), job.closedAt ?? now),
  }));
  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="energy" />
      <div className="studio">
      <h1 className="status-title">Energy</h1>
      <EnergyBoard initial={dashboard()} />
      <h2 className="section-label">By job</h2>
      <section className="panel table-wrap">
        {rows.length === 0 ? <div className="empty"><p>No jobs yet. Energy totals show after the first print is recorded.</p></div> : (
          <table className="table">
            <thead><tr><th>File</th><th>Result</th><th className="num">kWh</th></tr></thead>
            <tbody>
              {rows.map(({ job, wh }) => (
                <tr key={job.id}>
                  <td>{job.filename ?? "Untitled"}</td>
                  <td className={resultTone(job.result)}>{job.result.charAt(0) + job.result.slice(1).toLowerCase()}</td>
                  <td className="num">{wh === null ? "-" : (wh / 1000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      </div>
    </main>
  );
}

function resultTone(value: string): string {
  const name = value.toUpperCase();
  if (name === "FINISH") return "result-ok";
  if (name === "FAILED") return "result-bad";
  return "result-mid";
}
