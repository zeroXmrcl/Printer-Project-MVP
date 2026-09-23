import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, integrateWh } from "@printcast/contracts";
import { SiteHeader } from "../../../components/chrome";
import { TelemetrySpark } from "../../../components/widgets/telemetry-spark";
import { TimelapseGallery } from "../../../components/widgets/timelapse-gallery";
import { job, media, samples, settings } from "../../../lib/store";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = job(id);
  if (!row) notFound();
  const display = settings();
  const series = samples(row.id);
  const wh = integrateWh(series.map((sample) => ({ at: sample.at, watts: sample.watts })), row.closedAt ?? Date.now());
  const percent = row.lastPercent === null ? null : Math.round(row.lastPercent);
  const ended = row.closedAt ?? Date.now();
  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="prints" />
      <Link className="back" href="/prints">Prints</Link>
      <section className="widget pad">
        <div className="job-main">
          <div className="file-thumb">3MF</div>
          <div>
            <div className="job-file">{row.filename ?? "Untitled"}</div>
            <div className="job-pct-row">
              <b>{percent === null ? "—" : `${percent}%`}</b>
              <span className="muted">{title(row.result)} · {formatDuration(row.openedAt, ended)} · {when(ended)}</span>
            </div>
            {percent !== null ? <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div> : null}
            <div className="muted">Layer {row.lastLayer ?? "—"}{row.lastTotalLayers ? ` / ${row.lastTotalLayers}` : ""}</div>
          </div>
        </div>
        <div className="tech">
          <span>{wh === null ? "Estimate —" : `${(wh / 1000).toFixed(2)} kWh est.`}</span>
        </div>
      </section>
      <section className="widget pad">
        <div className="kicker">Estimate</div>
        <div className="read">{wh === null ? "—" : `${(wh / 1000).toFixed(2)} kWh`}</div>
        <TelemetrySpark samples={series} />
        <div className="muted">Nozzle · bed · progress</div>
      </section>
      <section className="widget pad">
        <div className="kicker">Frames</div>
        <TimelapseGallery items={media(row.id)} />
      </section>
    </main>
  );
}

function title(value: string): string {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : "—";
}

function when(epoch: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(epoch));
}
