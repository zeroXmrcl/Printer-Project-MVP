import { integrateWh } from "@printcast/contracts";
import { SiteHeader } from "../../components/chrome";
import { currentLive, jobs, samples, settings } from "../../lib/store";

export const dynamic = "force-dynamic";

export default function EnergyPage() {
  const display = settings();
  const live = currentLive();
  const now = Date.now();
  const rows = jobs().map((job) => ({
    job,
    wh: integrateWh(samples(job.id).map((sample) => ({ at: sample.at, watts: sample.watts })), job.closedAt ?? now),
  }));
  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="energy" />
      <section className="widget pad">
        <div className="kicker">Estimate</div>
        <p className="watt">{live.energy.watts === null ? "—" : `${live.energy.watts} W`}</p>
      </section>
      <div className="section-label">By job</div>
      <section className="widget">
        {rows.length === 0 ? <p className="pad note">No jobs yet.</p> : (
          <table className="table">
            <thead><tr><th>File</th><th>Result</th><th className="num">kWh</th></tr></thead>
            <tbody>
              {rows.map(({ job, wh }) => (
                <tr key={job.id}>
                  <td>{job.filename ?? "Untitled"}</td>
                  <td>{job.result.charAt(0) + job.result.slice(1).toLowerCase()}</td>
                  <td className="num">{wh === null ? "—" : (wh / 1000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
