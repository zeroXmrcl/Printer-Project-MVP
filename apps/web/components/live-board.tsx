"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LiveView } from "@printcast/contracts";
import type { BoardJob, BoardSnapshot } from "../lib/store";
import { snapshotThumbSrc } from "../lib/snapshot-thumb";
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
  const cinemaRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
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

  const percent = live.percent === null ? null : Math.max(0, Math.min(100, Math.round(live.percent)));
  const age = live.ageMs === null ? "-" : `${Math.round(live.ageMs / 1000)}s`;
  const pushall = live.pushallAt
    ? new Date(live.pushallAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "-";
  const slot = slotMark(live);
  const step = statusStep(live);
  const active = printing(live.state);
  const drying = live.ams.drying === true;
  const finished = percent === 100;
  const hideJob = drying && !board.amsOwnSupply;
  const cameraVisible = board.alwaysShowCamera || active;
  const cinematic = cameraVisible && !finished && !reduceMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = cinemaRef.current;
    if (!el || !cinematic) return;
    let last = -1;
    const apply = () => {
      const fade = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight || 1)));
      const step = Math.round(fade * 24) / 24;
      if (step === last) return;
      last = step;
      el.style.opacity = String(1 - step);
      el.style.filter = step === 0 ? "none" : `blur(${Math.round(step * 18)}px)`;
    };
    apply();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [cinematic]);
  const printKey = board.jobs
    .filter(isGalleryPrint)
    .map((job) => [job.id, job.still, job.filename ?? "", job.result, job.openedAt, job.closedAt].join("\t"))
    .join("\n");
  const prints = useMemo(() => board.jobs.filter(isGalleryPrint), [printKey]);

  const camera = <PrinterCam url={live.cameraUrl} visible={cameraVisible} />;

  return (
    <>
    {cinematic ? (
      <div className="cinema">
        <div className="cinema-frame" ref={cinemaRef}>
          {camera}
          <StreamHud live={live} percent={percent} finished={finished} active={active} />
        </div>
      </div>
    ) : null}
    <div className={cinematic ? "board-sheet" : undefined}>
    <div className="handy">
      {live.door === "open" ? (
        <div className="iconrow" aria-label="Live status icons">
          <span title="Door open">
            <svg className="door" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1h7l3 3v13H2z" fill="none" stroke="#e85d5d" strokeWidth="1.4" /><circle cx="8" cy="10" r="1" fill="#e85d5d" /></svg>
          </span>
        </div>
      ) : null}
      {cinematic ? null : (
        <section className="widget cam-widget">
          {camera}
        </section>
      )}

      {hideJob ? <Drying live={live} remainingRatio={board.dryRemainingRatio} /> : (
        <section className="widget pad">
          <div className="job-main">
            <div className={finished ? "file-thumb done" : active ? "file-thumb spin" : "file-thumb"} aria-hidden="true">
              {finished ? <svg className="job-check" viewBox="0 0 22 22"><path d="M5 11.5 9 15.5 17 7" /></svg> : null}
            </div>
            <div>
              <div className="job-file">{live.filename ?? "No file"}</div>
              <div className="job-pct-row">
                <b className={finished ? "done" : undefined}>{percent === null ? "-" : `${percent}%`}</b>
                <span className="muted">{finished ? "Finished" : `${live.remainingLabel ? `about ${live.remainingLabel}` : ""}${live.etaLabel ? `${live.remainingLabel ? " · " : ""}ends ${live.etaLabel}` : ""}`}</span>
              </div>
              {percent !== null && (live.showBar || finished) ? <div className="bar"><i style={{ width: `${percent}%` }} /></div> : null}
              <JobQuietLine live={live} active={active} />
            </div>
          </div>
        </section>
      )}
      {drying && board.amsOwnSupply ? <Drying live={live} remainingRatio={board.dryRemainingRatio} /> : null}

      <div className="temps3">
        <section className="widget pad">
          <div className="kicker">Nozzle</div>
          <div className="read">{num(live.temps.nozzle.actual)}<small>/{num(live.temps.nozzle.target)}°C</small></div>
        </section>
        <section className="widget pad">
          <div className="kicker">Bed</div>
          <div className="read">{num(live.temps.bed.actual)}<small>/{num(live.temps.bed.target)}°C</small></div>
        </section>
        <section className="widget pad">
          <div className="kicker">Chamber</div>
          <div className="read">{num(live.temps.chamber.actual)}<small>°C</small></div>
        </section>
      </div>
      <div className="fan-energy">
        <section className="widget pad">
          <div className="kicker">Fans</div>
          <div className="fanline">
            <Fan name="Part" value={live.fans.part} />
            <Fan name="Aux" value={live.fans.aux} />
            <Fan name="Heatbreak" value={live.fans.heatbreak} />
            {live.fans.aux2 !== null ? <Fan name="Fan 2" value={live.fans.aux2} /> : null}
          </div>
        </section>
        <section className="widget pad">
          <div className="kicker">Energy</div>
          <div className="speed-read">{live.energy.watts === null ? "-" : <>{live.energy.watts}<small>W</small></>}</div>
          {board.kwh !== null ? <div className="home-kwh">{(board.kwh / 1000).toFixed(2)} kWh this job</div> : null}
        </section>
      </div>
      <div className="grid2">
        <section className="widget pad">
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
        </section>
        <section className={`widget pad air-widget${tone ? ` ${tone}` : ""}`}>
          <div className="kicker">Air</div>
          <div className="speed-name">{live.airflow ?? "-"}</div>
          {tone ? (
            <div className="air-stage" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          ) : null}
        </section>
      </div>

      <h2 className="section-label">Filament</h2>
      <section className="widget pad">
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
              <Reel color={item.color} remaining={item.remain} active={item.active} empty={!item.type} />
              <div className="reel-id">A{index + 1}</div>
              <div className="reel-state">{item.type ?? "Empty"}</div>
              <div className="reel-rem">{item.remain === null ? "-" : `${Math.round(item.remain)}%`}</div>
            </div>
          ))}
          <div className={live.ams.external?.active ? "reel on" : "reel"}>
            <Reel color={live.ams.external?.color ?? null} remaining={live.ams.external?.remain ?? null} active={live.ams.external?.active === true} empty={!live.ams.external?.type} />
            <div className="reel-id">EXT</div>
            <div className="reel-state">{live.ams.external?.type ?? "External"}</div>
            <div className="reel-rem">{live.ams.external == null || live.ams.external.remain === null ? "no RFID" : `${Math.round(live.ams.external.remain)}%`}</div>
          </div>
        </div>
      </section>

      <h2 className="section-label">Faults and link</h2>
      <section className="widget pad">
        {live.hms.map((item) => (
          <a className="hms" key={item.code} href={item.wikiUrl} target="_blank" rel="noreferrer"><b>{item.code}</b>{item.message}</a>
        ))}
        <dl className="pairs">
          <div className="pair"><dt>Print error</dt><dd>{live.printError === null ? "None" : live.printError}</dd></div>
          <div className="pair"><dt>Wi-Fi</dt><dd className="wifi-read"><WifiMark signal={live.wifi} />{live.wifi ?? "-"}</dd></div>
          <div className="pair"><dt>MQTT age</dt><dd>{age}</dd></div>
          <div className="pair"><dt>Last pushall</dt><dd>{pushall}</dd></div>
        </dl>
      </section>

      <h2 className="section-label">Prints</h2>
      <section className="widget print-strip">
        {prints.length === 0 ? (
          <div className="pad"><p className="muted">No finished prints yet.</p></div>
        ) : (
          <PrintCarousel prints={prints} />
        )}
      </section>

      {board.photos.length > 0 ? (
        <>
          <h2 className="section-label">Printer</h2>
          <section className="widget pad">
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
    </div>
    </div>
    </>
  );
}

function isGalleryPrint(job: BoardJob): job is BoardJob & { still: string } {
  return job.closedAt !== null && typeof job.still === "string" && job.still.length > 0;
}

function PrintCarousel({ prints }: { prints: Array<BoardJob & { still: string }> }) {
  const frames = prints.length > 1 ? [...prints, ...prints] : prints;
  return (
    <div className="print-carousel" aria-label="Finished prints">
      <div className="print-carousel-track" style={{ ["--marquee" as string]: `${Math.max(prints.length, 1) * 8}s` }}>
        {frames.map((job, index) => (
          <figure className={index >= prints.length ? "print-carousel-clone" : undefined} key={`${job.id}-${index}`}>
            <img src={snapshotThumbSrc(`/api/media/${job.still}`)} alt="" width={320} height={180} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function Dial({ label, value, unit, fraction }: { label: string; value: string; unit: string; fraction: number }) {
  const r = 46;
  const turn = 2 * Math.PI * r;
  const amount = Math.max(0, Math.min(1, fraction)) * turn;
  const ticks = Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2 - Math.PI / 2;
    return (
      <line
        key={index}
        x1={60 + Math.cos(angle) * 36}
        y1={60 + Math.sin(angle) * 36}
        x2={60 + Math.cos(angle) * 43}
        y2={60 + Math.sin(angle) * 43}
        stroke="#fff"
        strokeWidth="0.8"
      />
    );
  });
  return (
    <svg className="dial" viewBox="0 0 120 120" aria-hidden="true">
      {ticks}
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1.1" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeDasharray={`${amount} ${turn}`}
        transform="rotate(-90 60 60)"
      />
      <text className="dial-label" x="60" y="50" textAnchor="middle">{label}</text>
      <text className="dial-value" x="60" y="72" textAnchor="middle">{value}</text>
      <text className="dial-unit" x="60" y="86" textAnchor="middle">{unit}</text>
    </svg>
  );
}

function StreamHud({ live, percent, finished }: { live: LiveView; percent: number | null; finished: boolean; active: boolean }) {
  const progress = percent === null ? 0 : percent / 100;
  const stage = live.stageLabel && live.stageLabel !== "-" ? live.stageLabel : finished ? "Finished" : "Printing";
  const meta = [
    live.layer !== null ? `Layer ${live.layer}${live.totalLayers !== null ? ` / ${live.totalLayers}` : ""}` : null,
    stage,
    live.remainingLabel ? `about ${live.remainingLabel}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div className="cam-overlay">
      <section className="cam-panel">
        <div className="cam-metrics">
          <div><span>Bed</span><b>{num(live.temps.bed.actual)}°</b></div>
          <div><span>Chamber</span><b>{num(live.temps.chamber.actual)}°</b></div>
          <div><span>Speed</span><b>{live.speed.magnitude ?? "-"}</b></div>
          <div><span>Air</span><b>{live.airflow ?? "-"}</b></div>
        </div>
      </section>
      <div className="cam-overlay-row">
        <section className="cam-panel">
          <p className="cam-title">{live.filename ?? "No file"}</p>
          <p className="cam-meta">{meta || "Idle"}</p>
        </section>
        <section className="cam-panel cam-dials">
          <Dial label="PROGRESS" value={percent === null ? "-" : String(percent)} unit="%" fraction={progress} />
          <Dial label="NOZZLE" value={num(live.temps.nozzle.actual)} unit="°C" fraction={(live.temps.nozzle.actual ?? 0) / 300} />
        </section>
      </div>
    </div>
  );
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
    <section className="widget pad">
      <div className="dry-top">
        <div>
          <div className="kicker">Drying</div>
          <div className="dry-time">{minutes === null ? "-" : dryLabel(minutes)}<small>left</small></div>
          {program ? <div className="muted dry-program">{program}</div> : null}
        </div>
        <svg className="dry-heat" viewBox="0 0 64 64" role="img" aria-label={`${left}% of this dry cycle left`}>
          <circle cx="32" cy="32" r="24" fill="none" stroke="#2e2e2e" strokeWidth="4" />
          <circle cx="32" cy="32" r="24" fill="none" stroke="#f5a524" strokeWidth="4" strokeLinecap="round" strokeDasharray={DRY_RING} strokeDashoffset={DRY_RING * (1 - ratio)} transform="rotate(-90 32 32)" />
        </svg>
      </div>
      <div className="dry-stats">
        <div><span>Temperature</span><b>{live.ams.temperatureC === null ? "-" : Math.round(live.ams.temperatureC)}<small>°C</small></b></div>
        <div><span>Humidity</span><b>{humidity === null ? "-" : `${Math.round(humidity)}% RH`}</b></div>
      </div>
    </section>
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

function Fan({ name, value }: { name: string; value: number | null }) {
  const speed = value ?? 0;
  const lit = speed <= 0 ? 0 : speed < 40 ? 1 : speed < 80 ? 2 : 3;
  const hue = speed >= 70 ? "#3ddc84" : speed > 0 ? "#d4a017" : "#3f3f46";
  const blades = [0, 1, 2].map((index) => (index < lit ? hue : "#3f3f46"));
  return (
    <div className="fan">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="3" fill="#f4f4f5" />
        <path d="M16 16 L16 4 A8 8 0 0 1 26 12 Z" fill={blades[0]} />
        <path d="M16 16 L28 20 A8 8 0 0 1 18 28 Z" fill={blades[1]} />
        <path d="M16 16 L6 24 A8 8 0 0 1 6 10 Z" fill={blades[2]} />
      </svg>
      <div><div className="muted">{name}</div><b>{value === null ? "-" : Math.round(value)}</b></div>
    </div>
  );
}

function WifiMark({ signal }: { signal: string | null }) {
  const match = signal?.match(/-?\d+/);
  const dbm = match ? Number(match[0]) : null;
  const bars = dbm === null ? 0 : dbm >= -50 ? 4 : dbm >= -60 ? 3 : dbm >= -67 ? 2 : dbm >= -75 ? 1 : 0;
  const on = "#3ddc84";
  const off = "#3f3f46";
  return (
    <svg className="wifi" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 9.2a13 13 0 0 1 17.6 0" fill="none" stroke={bars >= 4 ? on : off} strokeWidth="2" strokeLinecap="round" />
      <path d="M6.4 12.4a8.2 8.2 0 0 1 11.2 0" fill="none" stroke={bars >= 3 ? on : off} strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 15.5a3.6 3.6 0 0 1 5 0" fill="none" stroke={bars >= 2 ? on : off} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="19" r="1.5" fill={bars >= 1 ? on : off} />
    </svg>
  );
}

function Reel({ color, remaining, active, empty }: { color: string | null; remaining: number | null; active: boolean; empty?: boolean }) {
  const fill = color ?? "#3f3f46";
  const radius = 20;
  const turns = 2 * Math.PI * radius;
  const amount = empty || remaining === null ? 0 : Math.max(0, Math.min(100, remaining));
  const wound = (amount / 100) * turns;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="37" fill="#141416" stroke={active ? fill : "rgba(255,255,255,0.16)"} strokeWidth={active ? 2 : 1.5} />
      <circle cx="40" cy="40" r="30" fill="#101012" />
      {wound > 0 ? (
        <circle cx="40" cy="40" r={radius} fill="none" stroke={fill} strokeWidth="13" strokeDasharray={`${wound} ${turns - wound}`} strokeLinecap="butt" transform="rotate(-90 40 40)" opacity={active ? 1 : 0.82} />
      ) : null}
      <circle cx="40" cy="40" r="11" fill="#1c1c1f" stroke="rgba(255,255,255,0.22)" />
      <circle cx="40" cy="40" r="3.5" fill={empty || !color ? "#3f3f46" : fill} />
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
