"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LiveView } from "@printcast/contracts";
import type { BoardJob, BoardSnapshot } from "../lib/store";
import { snapshotThumbSrc } from "../lib/snapshot-thumb";
import { ArtGallery } from "./widgets/art-gallery";
import { PrinterCam } from "./widgets/printer-cam";

const SPEEDS = [
  { level: 1, name: "Silent", magnitude: 50 },
  { level: 2, name: "Standard", magnitude: 100 },
  { level: 3, name: "Sport", magnitude: 124 },
  { level: 4, name: "Ludicrous", magnitude: 166 },
];
const LEVELS = [
  { id: "A", color: "#3ddc84" },
  { id: "B", color: "#c6d63a" },
  { id: "C", color: "#f5a524" },
  { id: "D", color: "#ee6a40" },
  { id: "E", color: "#b91c1c" },
];

export function LiveBoard({ initial }: { initial: BoardSnapshot }) {
  const [board, setBoard] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const live = board.live;
  const tone = airTone(live.airflow);

  useEffect(() => {
    const source = new EventSource("/api/live");
    const onLive = (event: Event) => {
      const data = (event as MessageEvent).data;
      if (!data || data === "null") return;
      setBoard(JSON.parse(data) as BoardSnapshot);
    };
    source.addEventListener("live", onLive);
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const percent = live.percent === null ? null : Math.max(0, Math.min(100, Math.round(live.percent)));
  const age = live.ageMs === null ? "-" : `${Math.round(live.ageMs / 1000)}s`;
  const pushall = live.pushallAt
    ? new Date(live.pushallAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "-";
  const slot = slotMark(live);
  const step = statusStep(live);
  const heading = live.filamentModule ? `${live.deviceName ?? "P2S"} + ${live.filamentModule}` : (live.deviceName ?? "P2S");
  const active = printing(live.state);
  const stale = live.ageMs !== null && live.ageMs > 15_000;
  const drying = live.ams.drying === true;
  const finished = percent === 100;
  const hideJob = drying && !board.amsOwnSupply;
  const printKey = board.jobs
    .filter(isGalleryPrint)
    .map((job) => [job.id, job.still, job.filename ?? "", job.result, job.openedAt, job.closedAt].join("\t"))
    .join("\n");
  const prints = useMemo(() => board.jobs.filter(isGalleryPrint), [printKey]);
  const selected = prints.find((job) => job.id === selectedId) ?? null;

  return (
    <div className="studio">
      <div className="statusline">
        <h1 className="status-title">{heading}</h1>
        <div className="status-aside">
          <StatusChip state={live.state} finished={finished} stale={stale} />
          <span className="status-wifi" title={live.wifi ?? "Wi-Fi"}>
            <WifiMark signal={live.wifi} />
            {live.wifi ?? "-"}
          </span>
        </div>
      </div>

      {live.door === "open" ? (
        <div className="iconrow" aria-label="Live status icons">
          <span title="Door open">
            <svg className="door" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1h7l3 3v13H2z" strokeWidth="1.4" /><circle cx="8" cy="10" r="1" /></svg>
          </span>
        </div>
      ) : null}

      <section className="stage">
        <div className="cam-widget">
          <PrinterCam url={live.cameraUrl} visible={board.alwaysShowCamera || printing(live.state)} />
        </div>
        {hideJob ? <Drying live={live} remainingRatio={board.dryRemainingRatio} /> : (
          <div className="job-strip">
            <div className="job-main">
              <div className={finished ? "file-thumb done" : active ? "file-thumb spin" : "file-thumb"} aria-hidden="true">
                {finished ? <svg className="job-check" viewBox="0 0 22 22"><path d="M5 11.5 9 15.5 17 7" /></svg> : null}
              </div>
              <div>
                <div className="job-file">{live.filename ?? "No file"}</div>
                <div className="muted">{finished ? "Finished" : `${live.remainingLabel ? `about ${live.remainingLabel}` : ""}${live.etaLabel ? `${live.remainingLabel ? " · " : ""}ends ${live.etaLabel}` : ""}`}</div>
                <JobQuietLine live={live} active={active} />
              </div>
              <b className={finished ? "job-pct done" : "job-pct"}>{percent === null ? "-" : `${percent}%`}</b>
            </div>
            {percent !== null && (live.showBar || finished) ? <div className="bar"><i style={{ width: `${percent}%` }} /></div> : null}
          </div>
        )}
        {drying && board.amsOwnSupply ? <Drying live={live} remainingRatio={board.dryRemainingRatio} /> : null}
      </section>

      <section className="cluster" aria-label="Printer instruments">
        <div className="cluster-temps">
          <div className="cluster-cell">
            <div className="kicker">Nozzle</div>
            <div className="read">{num(live.temps.nozzle.actual)}<small>/{num(live.temps.nozzle.target)}°C</small></div>
          </div>
          <div className="cluster-cell">
            <div className="kicker">Bed</div>
            <div className="read">{num(live.temps.bed.actual)}<small>/{num(live.temps.bed.target)}°C</small></div>
          </div>
          <div className="cluster-cell">
            <div className="kicker">Chamber</div>
            <div className="read">{num(live.temps.chamber.actual)}<small>°C</small></div>
          </div>
        </div>
        <div className="cluster-split">
          <div className="cluster-cell">
            <div className="kicker">Fans</div>
            <div className="fanline">
              <Fan name="Part" value={live.fans.part} />
              <Fan name="Aux" value={live.fans.aux} />
              <Fan name="Heatbreak" value={live.fans.heatbreak} />
              {live.fans.aux2 !== null ? <Fan name="Fan 2" value={live.fans.aux2} /> : null}
            </div>
          </div>
          <div className="cluster-cell">
            <div className="kicker">Energy</div>
            <div className="speed-read">{live.energy.watts === null ? "-" : <>{live.energy.watts}<small>W</small></>}</div>
            {board.kwh !== null ? <div className="home-kwh">{(board.kwh / 1000).toFixed(2)} kWh this job</div> : null}
          </div>
        </div>
        <div className="cluster-split">
          <div className="cluster-cell">
            <div className="kicker">Speed</div>
            <div className="speed-read">{live.speed.magnitude ?? "-"}<small>{live.speed.name ?? ""}</small></div>
            <div className="speed-rail">
              {SPEEDS.map((mode) => (
                <div key={mode.level} className={speedOn(live, mode) ? "on" : undefined}>
                  <b />
                  <span>{mode.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`cluster-cell air-widget${tone ? ` ${tone}` : ""}`}>
            <div className="kicker">Air</div>
            <div className="speed-name">{live.airflow ?? "-"}</div>
            {tone ? (
              <div className="air-stage" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <h2 className="section-label">Filament</h2>
      <section className="panel pad">
        <div className="ams-head">
          <div className="ams-title">AMS-A</div>
          <div className="ams-meta">
            {percentNative(live.ams.model) && !board.showAmsGrade ? null : (
              <div className="levels" aria-label={live.ams.grade ? `Humidity level ${live.ams.grade}` : "Humidity level"}>
                {LEVELS.map((level) => (
                  <span key={level.id} className={live.ams.grade === level.id ? "now" : undefined} style={{ ["--lv" as string]: level.color }}>{level.id}</span>
                ))}
              </div>
            )}
            <div className={`hum${humidityTone(live.ams.humidityPercent)}`}>
              <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0 C6 0 0 7 0 10 a6 6 0 0 0 12 0 C12 7 6 0 6 0z" fill="currentColor" /></svg>
              {" "}{live.ams.humidityPercent === null ? "- RH" : `${Math.round(live.ams.humidityPercent)}% RH`}
              {live.ams.temperatureC !== null ? ` · ${Math.round(live.ams.temperatureC)}°C` : ""}
            </div>
            <div className="status-pill" aria-label={`Status ${step}`}>
              <span className={step === "off" ? "now" : undefined} style={{ ["--lv" as string]: "#a8b0bd" }}>Off</span>
              <span className={step === "idle" ? "now" : undefined} style={{ ["--lv" as string]: "#3ddc84" }}>Idle</span>
              <span className={step === "slot" ? `now${lightInk(slot.color) ? "" : " light"}` : undefined} style={{ ["--lv" as string]: slot.color }}>{slot.label}</span>
              <span className={live.ams.drying === true ? "now" : undefined} style={{ ["--lv" as string]: "#f5a524" }}>Drying</span>
            </div>
          </div>
        </div>
        <div className="reel-row">
          {live.ams.slots.map((item, index) => (
            <div className={item.active ? "reel on" : "reel"} key={item.id || index}>
              <div className="reel-state">{item.type ?? "Empty"}</div>
              <Reel color={item.color} label={`A${index + 1}`} />
              <div className="reel-rem">{item.remain === null ? "-" : `${Math.round(item.remain)}%`}</div>
            </div>
          ))}
          <div className={live.ams.external?.active ? "reel on" : "reel"}>
            <div className="reel-state">{live.ams.external?.type ?? "External"}</div>
            <Reel color={live.ams.external?.color ?? null} label="EXT" dashed={!live.ams.external?.type} />
            <div className="reel-rem">{live.ams.external == null || live.ams.external.remain === null ? "no RFID" : `${Math.round(live.ams.external.remain)}%`}</div>
          </div>
        </div>
      </section>

      <h2 className="section-label">Health</h2>
      <section className="panel pad">
        {live.hms.map((item) => (
          <a className="hms" key={item.code} href={item.wikiUrl} target="_blank" rel="noreferrer"><b>{item.code}</b>{item.message}</a>
        ))}
        <dl className="pairs">
          <div className="pair"><dt>Print error</dt><dd>{live.printError === null ? "None" : live.printError}</dd></div>
          <div className="pair"><dt>Wi-Fi</dt><dd>{live.wifi ?? "-"}</dd></div>
          <div className="pair"><dt>MQTT age</dt><dd>{age}</dd></div>
          <div className="pair"><dt>Last pushall</dt><dd>{pushall}</dd></div>
        </dl>
      </section>

      <h2 className="section-label">Prints</h2>
      <section className="panel">
        {prints.length === 0 ? (
          <div className="empty"><p>No finished stills yet. A snapshot appears here when a job ends with a frame.</p></div>
        ) : (
          <ArtGallery
            images={prints.map((job) => snapshotThumbSrc(`/api/media/${job.still}`))}
            items={prints.map((job) => ({
              title: job.filename ?? "Untitled",
              year: job.closedAt ? new Date(job.closedAt).getFullYear() : "",
            }))}
            onSelect={(index) => {
              const job = prints[index];
              if (job) setSelectedId(job.id);
            }}
          />
        )}
      </section>

      {board.photos.length > 0 ? (
        <>
          <h2 className="section-label">Printer</h2>
          <section className="panel pad">
            <div className="kicker">Photos</div>
            <div className="frames">
              {board.photos.map((photo) => (
                <figure key={photo.name}>
                  <img src={photo.url} alt="" width={320} height={180} loading="lazy" />
                  <figcaption>{photo.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {selected?.still ? (
        <div className="print-pop-veil" onClick={() => setSelectedId(null)}>
          <div
            className="print-pop"
            role="dialog"
            aria-modal="true"
            aria-label={selected.filename ?? "Print"}
            onClick={(event) => event.stopPropagation()}
          >
            <img src={`/api/media/${selected.still}`} alt="" />
            <div className="print-pop-body">
              <div className="print-pop-head">
                <b>{selected.filename ?? "Untitled"}</b>
                <button ref={closeRef} type="button" onClick={() => setSelectedId(null)}>Close</button>
              </div>
              <p className={plateTone(selected.result)}>{plateCaption(selected, true)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isGalleryPrint(job: BoardJob): job is BoardJob & { still: string } {
  return job.closedAt !== null && typeof job.still === "string" && job.still.length > 0;
}

function plateTone(result: string): string {
  const name = result.toUpperCase();
  if (name === "FINISH") return "ok";
  if (name === "FAILED") return "bad";
  return "";
}

function plateCaption(job: { result: string; openedAt: number; closedAt: number | null }, full: boolean): string {
  const result = titleCase(job.result);
  const length = printLength(job.openedAt, job.closedAt ?? Date.now());
  if (!full && result.toLowerCase() === "finish") return length;
  return `${result} · ${length}`;
}

function printLength(start: number, end: number): string {
  const whole = Math.max(0, Math.round((end - start) / 60_000));
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function titleCase(value: string): string {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : "-";
}

function printing(state: string): boolean {
  return state === "PREPARE" || state === "RUNNING" || state === "PAUSE";
}

const DRY_RING = 2 * Math.PI * 24;

function Drying({ live, remainingRatio }: { live: LiveView; remainingRatio: number | null }) {
  const minutes = live.ams.dryRemainingMin;
  const humidity = live.ams.humidityPercent;
  const ratio = remainingRatio === null ? 0 : Math.min(1, Math.max(0, remainingRatio));
  const left = Math.round(ratio * 100);
  const program = dryProgramLine(live);
  return (
    <div className="dry-strip">
      <div className="dry-top">
        <div>
          <div className="kicker">Drying</div>
          <div className="dry-time">{minutes === null ? "-" : dryLabel(minutes)}<small>left</small></div>
          {program ? <div className="muted dry-program">{program}</div> : null}
        </div>
        <svg className="dry-heat" viewBox="0 0 64 64" role="img" aria-label={`${left}% of this dry cycle left`}>
          <circle className="track" cx="32" cy="32" r="24" fill="none" strokeWidth="4" />
          <circle className="left" cx="32" cy="32" r="24" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={DRY_RING} strokeDashoffset={DRY_RING * (1 - ratio)} transform="rotate(-90 32 32)" />
        </svg>
      </div>
      <div className="dry-stats">
        <div><span>Temperature</span><b>{live.ams.temperatureC === null ? "-" : Math.round(live.ams.temperatureC)}<small>°C</small></b></div>
        <div><span>Humidity</span><b>{humidity === null ? "-" : `${Math.round(humidity)}% RH`}</b></div>
      </div>
    </div>
  );
}

function dryProgramLine(live: LiveView): string | null {
  const filament = live.ams.dryFilament;
  const temp = live.ams.dryTemperatureC;
  const hours = live.ams.dryDurationHours;
  const bits: string[] = [];
  if (filament) bits.push(filament);
  if (temp !== null && hours !== null) bits.push(`${Math.round(temp)}°C for ${formatProgramHours(hours)}`);
  else if (temp !== null) bits.push(`${Math.round(temp)}°C`);
  else if (hours !== null) bits.push(formatProgramHours(hours));
  return bits.length > 0 ? bits.join(" · ") : null;
}

function formatProgramHours(hours: number): string {
  return `${hours} h`;
}

function dryLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

function JobQuietLine({ live, active }: { live: LiveView; active: boolean }) {
  const idle = live.state === "IDLE" || live.state === "UNKNOWN";
  const stage = live.stageLabel && live.stageLabel !== "-" ? live.stageLabel : null;
  const hasLayer = live.layer !== null;
  if (idle || (!active && !hasLayer && !stage) || (!hasLayer && !stage)) return null;

  const parts: ReactNode[] = [];
  if (live.layer !== null && live.totalLayers !== null) {
    parts.push(`Layer ${live.layer} / ${live.totalLayers}`);
  } else if (live.layer !== null) {
    parts.push(`Layer ${live.layer}`);
  }
  if (stage) parts.push(stage);

  const change = live.ams.filamentChange;
  if (change) {
    parts.push(
      <>
        <span style={{ color: change.from.color ?? undefined }}>{change.from.label}</span>
        {" → "}
        <span style={{ color: change.to.color ?? undefined }}>{change.to.label}</span>
      </>,
    );
  }

  if (parts.length === 0) return null;
  return (
    <div className="muted job-quiet">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </div>
  );
}

function StatusChip({ state, finished, stale }: { state: string; finished: boolean; stale: boolean }) {
  if (stale) return <span className="status-chip stale">Link stale</span>;
  if (finished) return <span className="status-chip ok">Finished</span>;
  const map: Record<string, { label: string; tone: string; dot?: boolean }> = {
    PREPARE: { label: "Preparing", tone: "live", dot: true },
    RUNNING: { label: "Printing", tone: "live", dot: true },
    PAUSE: { label: "Paused", tone: "live", dot: true },
    IDLE: { label: "Idle", tone: "" },
    FINISH: { label: "Finished", tone: "ok" },
  };
  const chip = map[state] ?? { label: "Unknown", tone: "" };
  return (
    <span className={`status-chip${chip.tone ? ` ${chip.tone}` : ""}`}>
      {chip.dot ? <i className={`dot${state === "PAUSE" ? "" : " ok"}`} aria-hidden="true" /> : null}
      {chip.label}
    </span>
  );
}

function Fan({ name, value }: { name: string; value: number | null }) {
  const speed = value ?? 0;
  const lit = speed <= 0 ? 0 : speed < 40 ? 1 : speed < 80 ? 2 : 3;
  const blade = (index: number) => (index < lit ? (speed >= 70 ? "fan-hi" : "fan-mid") : "fan-off");
  return (
    <div className="fan">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="fan-hub" cx="16" cy="16" r="3" />
        <path className={blade(0)} d="M16 16 L16 4 A8 8 0 0 1 26 12 Z" />
        <path className={blade(1)} d="M16 16 L28 20 A8 8 0 0 1 18 28 Z" />
        <path className={blade(2)} d="M16 16 L6 24 A8 8 0 0 1 6 10 Z" />
      </svg>
      <div><div className="muted">{name}</div><b>{value === null ? "-" : Math.round(value)}</b></div>
    </div>
  );
}

function WifiMark({ signal }: { signal: string | null }) {
  const match = signal?.match(/-?\d+/);
  const dbm = match ? Number(match[0]) : null;
  const bars = dbm === null ? 0 : dbm >= -50 ? 4 : dbm >= -60 ? 3 : dbm >= -67 ? 2 : dbm >= -75 ? 1 : 0;
  return (
    <svg className="wifi" viewBox="0 0 24 24" aria-hidden="true">
      <path className={bars >= 4 ? "wifi-on" : "wifi-off"} d="M3.2 9.2a13 13 0 0 1 17.6 0" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path className={bars >= 3 ? "wifi-on" : "wifi-off"} d="M6.4 12.4a8.2 8.2 0 0 1 11.2 0" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path className={bars >= 2 ? "wifi-on" : "wifi-off"} d="M9.5 15.5a3.6 3.6 0 0 1 5 0" fill="none" strokeWidth="2" strokeLinecap="round" />
      <circle className={bars >= 1 ? "wifi-dot-on" : "wifi-dot-off"} cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function Reel({ color, label, dashed }: { color: string | null; label: string; dashed?: boolean }) {
  return (
    <svg
      className={dashed ? "reel-svg dashed" : "reel-svg"}
      viewBox="0 0 80 96"
      width="72"
      height="86"
      aria-hidden="true"
      style={{ ["--reel" as string]: color ?? "var(--faint)" }}
    >
      <circle cx="36" cy="50" r="28" fill="var(--line)" />
      <circle className="disc" cx="30" cy="48" r="28" />
      <circle className="hub" cx="30" cy="48" r="10" />
      <text x="30" y="52" textAnchor="middle">{label}</text>
    </svg>
  );
}

function percentNative(model: string | null): boolean {
  return model === "AMS 2 Pro" || model === "AMS HT";
}

function humidityTone(percent: number | null): string {
  if (percent === null) return "";
  if (percent <= 20) return " hum-a";
  if (percent <= 30) return " hum-b";
  if (percent <= 40) return " hum-c";
  return " hum-d";
}

function statusStep(live: LiveView): "off" | "idle" | "slot" | "drying" {
  if (live.ams.drying === true) return "drying";
  if (live.ams.slots.some((slot) => slot.active) || live.ams.external?.active) return "slot";
  if (live.ams.present) return "idle";
  return "off";
}

function slotMark(live: LiveView): { label: string; color: string } {
  const change = live.ams.filamentChange;
  if (change) {
    return {
      label: `${change.from.label} → ${change.to.label}`,
      color: change.from.color ?? "#4c8dff",
    };
  }
  const index = live.ams.slots.findIndex((slot) => slot.active);
  if (index >= 0) return { label: `A${index + 1}`, color: live.ams.slots[index]?.color ?? "#4c8dff" };
  if (live.ams.external?.active) return { label: "EXT", color: live.ams.external.color ?? "#71717a" };
  return { label: "A-", color: "#4c8dff" };
}

function airTone(airflow: string | null): "cool" | "heat" | "laser" | "" {
  if (airflow === "Cooling") return "cool";
  if (airflow === "Heating") return "heat";
  if (airflow === "Laser") return "laser";
  return "";
}

function speedOn(live: LiveView, mode: { level: number; magnitude: number }): boolean {
  if (live.speed.level !== null) return live.speed.level === mode.level;
  return live.speed.magnitude === mode.magnitude;
}

function num(value: number | null): string {
  if (value === null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function lightInk(color: string): boolean {
  return luminance(color) > 160;
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  if (raw.length < 6) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return (r + g + b) / 3;
}
