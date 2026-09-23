"use client";

import { useEffect, useState } from "react";
import type { LiveView } from "@printcast/contracts";
import type { BoardSnapshot } from "../lib/store";
import { PrinterCam } from "./widgets/printer-cam";

const STOPS = [50, 100, 124, 166];
const LEVELS = [
  { id: "A", color: "#3ddc84" },
  { id: "B", color: "#c6d63a" },
  { id: "C", color: "#f5a524" },
  { id: "D", color: "#e85d32" },
  { id: "E", color: "#b91c1c" },
];

export function LiveBoard({ initial }: { initial: BoardSnapshot }) {
  const [board, setBoard] = useState(initial);
  const live = board.live;

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
  const age = live.ageMs === null ? "—" : `${Math.round(live.ageMs / 1000)}s`;
  const pushall = live.pushallAt
    ? new Date(live.pushallAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "—";
  const slot = slotMark(live);
  const step = statusStep(live);
  const heading = live.filamentModule
    ? `${live.deviceName ?? "P2S"} + ${live.filamentModule}`
    : (live.deviceName ?? "P2S");

  return (
    <div className="handy">
      <div className="statusline">
        <h1 className="status-title">{heading}</h1>
        <span className="status-wifi" title={live.wifi ?? "Wi-Fi"}>
          <WifiMark signal={live.wifi} />
          {live.wifi ?? "—"}
        </span>
      </div>

      <div className="iconrow" aria-label="Live status icons">
        {live.lightOn ? (
          <span title="Chamber light on">
            <svg className="bulb" viewBox="0 0 14 18" aria-hidden="true"><path d="M7 1a5 5 0 0 0-2 9.6V13h4v-2.4A5 5 0 0 0 7 1z" fill="#f5d76e" /><rect x="5" y="14" width="4" height="2" rx="0.5" fill="#f5d76e" /></svg>
            Light on
          </span>
        ) : null}
        {live.door === "open" ? (
          <span title="Door open">
            <svg className="door" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1h7l3 3v13H2z" fill="none" stroke="#e85d5d" strokeWidth="1.4" /><circle cx="8" cy="10" r="1" fill="#e85d5d" /></svg>
          </span>
        ) : null}
      </div>
      <section className="widget cam-widget">
        <PrinterCam url={live.cameraUrl} />
      </section>

      <section className="widget pad">
        <div className="job-main">
          <div className="file-thumb">{(live.printType ?? "3MF").slice(0, 4).toUpperCase()}</div>
          <div>
            <div className="job-file">{live.filename ?? "No file"}</div>
            <div className="job-pct-row">
              <b>{percent === null ? "—" : `${percent}%`}</b>
              <span className="muted">{live.remainingLabel ? `about ${live.remainingLabel}` : ""}{live.etaLabel ? `${live.remainingLabel ? " · " : ""}ends ${live.etaLabel}` : ""}</span>
            </div>
            {percent !== null && live.showBar ? <div className="bar"><i style={{ width: `${percent}%` }} /></div> : null}
          </div>
        </div>
      </section>

      <div className="temps3">
        <section className="widget pad">
          <div className="kicker">Nozzle</div>
          <div className="read">{num(live.temps.nozzle.actual)}<small>/{num(live.temps.nozzle.target)}°C</small></div>
          <div className="muted">{[live.nozzle.diameter, live.nozzle.type].filter(Boolean).join(" ").toLowerCase()}</div>
        </section>
        <section className="widget pad">
          <div className="kicker">Bed</div>
          <div className="read">{num(live.temps.bed.actual)}<small>/{num(live.temps.bed.target)}°C</small></div>
          {atTarget(live.temps.bed.actual, live.temps.bed.target) ? <div className="muted">At target</div> : null}
        </section>
        <section className="widget pad">
          <div className="kicker">Chamber</div>
          <div className="read">{num(live.temps.chamber.actual)}<small>°C</small></div>
        </section>
      </div>
      <section className="widget pad">
        <div className="kicker">Fans</div>
        <div className="fanline">
          <Fan name="Part" value={live.fans.part} />
          <Fan name="Aux" value={live.fans.aux} />
          <Fan name="Heatbreak" value={live.fans.heatbreak} />
          {live.fans.aux2 !== null ? <Fan name="Fan 2" value={live.fans.aux2} /> : null}
        </div>
      </section>
      <div className="grid2">
        <section className="widget pad">
          <div className="kicker">Speed</div>
          <div className="speed-name">{live.speed.name ?? "—"}</div>
          <div className="stops">
            {STOPS.map((stop) => (
              <span key={stop} className={live.speed.magnitude === stop ? "on" : undefined}>{stop}</span>
            ))}
          </div>
          <div className="muted">{live.speed.level !== null ? `Level ${live.speed.level}` : ""}{live.speed.magnitude !== null ? ` · magnitude ${live.speed.magnitude}%` : ""}</div>
        </section>
        <section className="widget pad">
          <div className="kicker">Air</div>
          <div className="air-row">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 14h14" stroke="#7ec8ff" strokeWidth="2" /><path d="M14 8l6 6-6 6" fill="none" stroke="#7ec8ff" strokeWidth="2" /></svg>
            <div className="speed-name">{live.airflow ?? "—"}</div>
          </div>
        </section>
      </div>

      <h2 className="section-label">Filament</h2>
      <section className="widget pad">
        <div className="ams-head">
          <div className="ams-title">AMS-A</div>
          <div className="ams-meta">
            <div className="levels" aria-label={live.ams.grade ? `Humidity level ${live.ams.grade}` : "Humidity level"}>
              {LEVELS.map((level) => (
                <span key={level.id} className={live.ams.grade === level.id ? "now" : undefined} style={{ ["--lv" as string]: level.color }}>{level.id}</span>
              ))}
            </div>
            <div className="hum">
              <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0 C6 0 0 7 0 10 a6 6 0 0 0 12 0 C12 7 6 0 6 0z" fill="#3d8bfd" /></svg>
              {" "}{live.ams.humidityPercent === null ? "— RH" : `${Math.round(live.ams.humidityPercent)}% RH`}
              {live.ams.temperatureC !== null ? ` · ${Math.round(live.ams.temperatureC)}°C` : ""}
            </div>
            <div className="status-pill" aria-label={`Status ${step}`}>
              <span className={step === "off" ? "now" : undefined} style={{ ["--lv" as string]: "#a8b0bd" }}>Off</span>
              <span className={step === "idle" ? "now" : undefined} style={{ ["--lv" as string]: "#3ddc84" }}>Idle</span>
              <span className={step === "slot" ? `now${lightInk(slot.color) ? "" : " light"}` : undefined} style={{ ["--lv" as string]: slot.color }}>{slot.label}</span>
              <span className={step === "drying" ? "now" : undefined} style={{ ["--lv" as string]: "#f5a524" }}>Drying</span>
            </div>
          </div>
        </div>
        <div className="reel-row">
          {live.ams.slots.map((item, index) => (
            <div className={item.active ? "reel on" : "reel"} key={item.id || index}>
              <div className="reel-state">{item.type ?? "Empty"}</div>
              <Reel color={item.color} label={`A${index + 1}`} />
              <div className="reel-rem">{item.remain === null ? "—" : `${Math.round(item.remain)}%`}</div>
            </div>
          ))}
          <div className={live.ams.external?.active ? "reel on" : "reel"}>
            <div className="reel-state">{live.ams.external?.type ?? "External"}</div>
            <Reel color={live.ams.external?.color ?? null} label="EXT" dashed={!live.ams.external?.type} />
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
          <div className="pair"><dt>Wi-Fi</dt><dd>{live.wifi ?? "—"}</dd></div>
          <div className="pair"><dt>MQTT age</dt><dd>{age}</dd></div>
          <div className="pair"><dt>Last pushall</dt><dd>{pushall}</dd></div>
        </dl>
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
      <div><div className="muted">{name}</div><b>{value === null ? "—" : Math.round(value)}</b></div>
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

function Reel({ color, label, dashed }: { color: string | null; label: string; dashed?: boolean }) {
  const fill = color ?? "#3f3f46";
  const ink = "#f4f4f5";
  return (
    <svg viewBox="0 0 80 96" width="72" height="86" aria-hidden="true">
      <circle cx="36" cy="50" r="28" fill="#2a2a2a" />
      <circle cx="30" cy="48" r="28" fill={dashed ? "none" : fill} stroke={dashed ? "#71717a" : "none"} strokeWidth="3" strokeDasharray={dashed ? "4 3" : undefined} />
      <circle cx="30" cy="48" r="10" fill="#181818" />
      <text x="30" y="52" textAnchor="middle" fill={dashed ? "#a1a1aa" : ink} fontSize="12" fontFamily="Geist, sans-serif">{label}</text>
    </svg>
  );
}

function statusStep(live: LiveView): "off" | "idle" | "slot" | "drying" {
  if (live.ams.drying) return "drying";
  if (live.ams.slots.some((slot) => slot.active) || live.ams.external?.active) return "slot";
  if (live.ams.present) return "idle";
  return "off";
}

function slotMark(live: LiveView): { label: string; color: string } {
  const index = live.ams.slots.findIndex((slot) => slot.active);
  if (index >= 0) return { label: `A${index + 1}`, color: live.ams.slots[index]?.color ?? "#4c8dff" };
  if (live.ams.external?.active) return { label: "EXT", color: live.ams.external.color ?? "#71717a" };
  return { label: "A–", color: "#4c8dff" };
}

function atTarget(actual: number | null, target: number | null): boolean {
  if (actual === null || target === null || target <= 0) return false;
  return Math.abs(actual - target) <= 1;
}

function num(value: number | null): string {
  if (value === null) return "—";
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
