import { energySentence, estimateWatts, type PowerModel } from "./energy";
import { visibleHms, type HmsMap } from "./hms";
import { firstPresent, num, text, type Json } from "./json";
import { STALE_MS } from "./log";

export type LiveView = {
  receivedAt: number | null;
  stale: boolean;
  ageMs: number | null;
  pushallAt: number | null;
  filename: string | null;
  state: string;
  percent: number | null;
  showBar: boolean;
  layer: number | null;
  totalLayers: number | null;
  remainingLabel: string | null;
  etaLabel: string | null;
  stageLabel: string;
  stageRaw: string | null;
  coverUrl: string | null;
  cameraUrl: string | null;
  lightOn: boolean | null;
  temps: {
    nozzle: { actual: number | null; target: number | null };
    bed: { actual: number | null; target: number | null };
    chamber: { actual: number | null };
  };
  fans: { part: number | null; aux: number | null; aux2: number | null; heatbreak: number | null };
  speedLabel: string | null;
  speed: { level: number | null; name: string | null; magnitude: number | null };
  airflow: string | null;
  filePath: string | null;
  printType: string | null;
  printError: number | null;
  cameraInfo: { resolution: string | null; timelapse: string | null };
  door: "open" | "closed" | null;
  facts: { label: string; value: string }[];
  ams: {
    present: boolean;
    temperatureC: number | null;
    humidityPercent: number | null;
    grade: string | null;
    drying: boolean | null;
    dryRemainingMin: number | null;
    slots: { id: string; type: string | null; color: string | null; remain: number | null; active: boolean }[];
    external: { type: string | null; color: string | null; remain: number | null; active: boolean } | null;
  };
  hms: { code: string; message: string; wikiUrl: string; severity: string | null }[];
  online: boolean;
  wifi: string | null;
  usageHours: number | null;
  nozzle: { diameter: string | null; type: string | null };
  energy: { watts: number | null; sentence: string };
};

const GRADES = ["", "A", "B", "C", "D", "E"];
const SPEED_NAMES: Record<number, string> = { 1: "Silent", 2: "Standard", 3: "Sport", 4: "Ludicrous" };
const SPEED_NOMINAL: Record<number, number> = { 1: 50, 2: 100, 3: 124, 4: 166 };
const NOZZLE_TYPES: Record<string, string> = {
  hardened_steel: "Hardened steel",
  stainless_steel: "Stainless steel",
};
const AIRDUCT: Record<number, string> = { 0: "Cooling", 1: "Heating", 2: "Laser" };

export function toLiveView(input: {
  print: Record<string, Json>;
  receivedAt: number | null;
  pushallAt: number | null;
  now: number;
  coverUrl: string | null;
  cameraUrl: string | null;
  stages: Record<string, string>;
  hms: HmsMap;
  power: PowerModel | null;
  mains: string | undefined;
}): LiveView {
  const { print } = input;
  const state = (text(print.gcode_state) ?? "UNKNOWN").toUpperCase();
  const stale = input.receivedAt === null || input.now - input.receivedAt > STALE_MS;
  const percent = num(print.mc_percent);
  const remaining = num(print.mc_remaining_time);
  const stageRaw = print.stg_cur === undefined || print.stg_cur === null ? null : String(print.stg_cur);
  const filename = text(print.subtask_name);
  const estimate = estimateWatts(print, input.power, input.mains);
  const lightOn = readLight(print.lights_report);
  const airflow = readAirflow(print);
  const usage = num(firstPresent(print, ["usage_hours", "total_usage_hours", "device_usage_hours"]));

  const view: LiveView = {
    receivedAt: input.receivedAt,
    stale,
    ageMs: input.receivedAt === null ? null : Math.max(0, input.now - input.receivedAt),
    pushallAt: input.pushallAt,
    filename,
    state,
    percent,
    showBar: percent !== null && state !== "IDLE" && state !== "UNKNOWN",
    layer: num(print.layer_num),
    totalLayers: num(print.total_layer_num),
    remainingLabel: remaining !== null && remaining > 0 ? formatMinutes(remaining) : null,
    etaLabel: remaining !== null && remaining > 0 ? formatWhen(input.now + remaining * 60_000, input.now) : null,
    stageLabel: stageRaw !== null && input.stages[stageRaw] ? input.stages[stageRaw] : stageRaw ?? "—",
    stageRaw,
    coverUrl: input.coverUrl,
    cameraUrl: input.cameraUrl,
    lightOn,
    temps: {
      nozzle: {
        actual: num(print.nozzle_temper),
        target: num(print.nozzle_target_temper ?? print.nozzle_temper_target),
      },
      bed: {
        actual: num(print.bed_temper),
        target: num(print.bed_target_temper ?? print.bed_temper_target),
      },
      chamber: { actual: num(print.chamber_temper) },
    },
    fans: {
      part: fanPercent(print.cooling_fan_speed),
      aux: fanPercent(print.big_fan1_speed ?? print.big_fan1),
      aux2: fanPercent(print.big_fan2_speed ?? print.big_fan2),
      heatbreak: fanPercent(print.heatbreak_fan_speed),
    },
    speedLabel: speedLabel(print),
    speed: readSpeed(print),
    airflow,
    filePath: text(print.gcode_file),
    printType: text(print.print_type),
    printError: readError(print.print_error),
    cameraInfo: readCamera(print.ipcam),
    door: readDoor(print),
    facts: [],
    ams: readAms(print),
    hms: visibleHms(print.hms, input.hms),
    online: !stale,
    wifi: text(print.wifi_signal),
    usageHours: usage,
    nozzle: {
      diameter: nozzleDiameter(print),
      type: nozzleType(print),
    },
    energy: { watts: estimate.watts, sentence: energySentence(estimate) },
  };
  view.facts = buildFacts(view);
  return view;
}

export function fanPercent(value: unknown): number | null {
  const raw = num(value);
  if (raw === null || raw < 0) return null;
  if (raw <= 15) return Math.round((raw / 15) * 100);
  if (raw <= 100) return Math.round(raw);
  return null;
}

export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatWhen(epochMs: number, now: number): string {
  const date = new Date(epochMs);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  if (sameDay) return clock;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
  return `${day}, ${clock}`;
}

export function formatDuration(start: number, end: number): string {
  return formatMinutes((end - start) / 60_000);
}

export function formatTemp(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function swatch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  if (!/^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex)) return null;
  return `#${hex.slice(0, 6)}`;
}

function readSpeed(print: Record<string, Json>): LiveView["speed"] {
  const level = num(print.spd_lvl);
  const magnitude = num(print.spd_mag) ?? (level !== null ? SPEED_NOMINAL[level] ?? null : null);
  return { level, name: level !== null ? SPEED_NAMES[level] ?? null : null, magnitude };
}

function readError(value: Json | undefined): number | null {
  const error = num(value);
  if (error === null || error === 0) return null;
  return error;
}

function readCamera(value: Json | undefined): LiveView["cameraInfo"] {
  if (!isPlain(value)) return { resolution: null, timelapse: null };
  return { resolution: text(value.resolution), timelapse: text(value.timelapse) };
}

function readDoor(print: Record<string, Json>): LiveView["door"] {
  const stat = text(print.stat);
  if (stat && /^[0-9a-f]+$/i.test(stat)) {
    return (Number.parseInt(stat, 16) & 0x00800000) !== 0 ? "open" : "closed";
  }
  const flag = num(print.home_flag);
  if (flag === null) return null;
  return (flag & 0x00800000) !== 0 ? "open" : "closed";
}

function buildFacts(view: LiveView): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value: String(value) });
  };
  add("State", view.state);
  add("File", view.filename);
  add("Path", view.filePath);
  add("Print type", view.printType);
  add("Progress", view.percent === null ? null : `${Math.round(view.percent)}%`);
  add("Layer", view.layer);
  add("Total layers", view.totalLayers);
  add("Remaining", view.remainingLabel);
  add("Ends", view.etaLabel);
  add("Stage", view.stageLabel === "—" ? null : view.stageLabel);
  add("Stage code", view.stageRaw);
  add("Nozzle", view.temps.nozzle.actual === null ? null : `${formatTemp(view.temps.nozzle.actual)} / ${formatTemp(view.temps.nozzle.target)}`);
  add("Bed", view.temps.bed.actual === null ? null : `${formatTemp(view.temps.bed.actual)} / ${formatTemp(view.temps.bed.target)}`);
  add("Chamber", formatTemp(view.temps.chamber.actual) === "—" ? null : formatTemp(view.temps.chamber.actual));
  add("Part fan", view.fans.part);
  add("Aux fan", view.fans.aux);
  add("Fan 2", view.fans.aux2);
  add("Heatbreak fan", view.fans.heatbreak);
  add("Speed", view.speed.name);
  add("Speed level", view.speed.level);
  add("Speed magnitude", view.speed.magnitude === null ? null : `${view.speed.magnitude}%`);
  add("Air", view.airflow);
  add("Nozzle size", view.nozzle.diameter);
  add("Nozzle type", view.nozzle.type);
  add("Light", view.lightOn === null ? null : view.lightOn ? "On" : "Off");
  add("Camera", view.cameraInfo.resolution);
  add("Timelapse", view.cameraInfo.timelapse);
  add("Door", view.door);
  add("Wi-Fi", view.wifi);
  add("Print error", view.printError);
  add("AMS temperature", view.ams.temperatureC === null ? null : `${view.ams.temperatureC}°C`);
  add("AMS grade", view.ams.grade);
  add("AMS humidity", view.ams.humidityPercent === null ? null : `${view.ams.humidityPercent}%`);
  add("Drying", view.ams.drying === null ? null : view.ams.drying ? `${view.ams.dryRemainingMin ?? ""} min`.trim() : "Off");
  for (const slot of view.ams.slots) {
    const bits = [slot.type ?? "empty", slot.remain === null ? "remain unknown" : `${slot.remain}%`, slot.active ? "active" : ""].filter(Boolean);
    add(`Slot ${slot.id || "?"}`, bits.join(" · "));
  }
  if (view.ams.external) {
    add("External spool", [view.ams.external.type ?? "unknown", view.ams.external.remain === null ? "no RFID" : `${view.ams.external.remain}%`].join(" · "));
  }
  add("Usage hours", view.usageHours);
  add("Estimate", view.energy.watts === null ? null : `${view.energy.watts} W`);
  return rows;
}

function speedLabel(print: Record<string, Json>): string | null {
  const level = num(print.spd_lvl);
  const mag = num(print.spd_mag);
  if (level === null && mag === null) return null;
  const name = level !== null ? SPEED_NAMES[level] : null;
  const shown = mag ?? (level !== null ? SPEED_NOMINAL[level] : null);
  if (name && shown !== null) return `${name} · ${shown}%`;
  if (shown !== null) return `${shown}%`;
  return name;
}

function readLight(value: Json | undefined): boolean | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const chamber = value.find((item) => isPlain(item) && item.node === "chamber_light");
  const chosen = isPlain(chamber) ? chamber : value.find(isPlain);
  if (!isPlain(chosen) || chosen.mode === undefined) return null;
  return chosen.mode === "on";
}

function readAirflow(print: Record<string, Json>): string | null {
  const device = print.device;
  if (!isPlain(device)) return null;
  const airduct = device.airduct;
  if (!isPlain(airduct) || airduct.modeCur === undefined) return null;
  const mode = num(airduct.modeCur);
  if (mode === null) return null;
  return AIRDUCT[mode] ?? String(mode);
}

function readAms(print: Record<string, Json>): LiveView["ams"] {
  const empty = { present: false, temperatureC: null, humidityPercent: null, grade: null, drying: null, dryRemainingMin: null, slots: [], external: null };
  const ams = print.ams;
  if (!isPlain(ams)) {
    return { ...empty, external: readExternal(print.vt_tray, false) };
  }
  const units = Array.isArray(ams.ams) ? ams.ams.filter(isPlain) : [];
  const unit = units[0] ?? null;
  const trayNow = num(ams.tray_now);
  const active = activeTray(trayNow);
  const slots = unit && Array.isArray(unit.tray)
    ? unit.tray.filter(isPlain).slice(0, 4).map((tray) => {
        const id = String(tray.id ?? "");
        const remain = num(tray.remain);
        return {
          id,
          type: text(tray.tray_type),
          color: swatch(tray.tray_color),
          remain: remain !== null && remain >= 0 ? remain : null,
          active: active.slotId === id && active.external === false,
        };
      })
    : [];
  const humidity = num(unit?.humidity);
  const raw = num(unit?.humidity_raw);
  const dry = num(unit?.dry_time);
  return {
    present: unit !== null,
    temperatureC: num(unit?.temp),
    humidityPercent: raw !== null && raw >= 1 && raw <= 100 ? raw : null,
    grade: humidity !== null && humidity >= 1 && humidity <= 5 ? GRADES[humidity] : null,
    drying: unit ? (dry ?? 0) > 0 : null,
    dryRemainingMin: dry !== null && dry > 0 ? dry : null,
    slots,
    external: readExternal(print.vt_tray, active.external),
  };
}

function activeTray(trayNow: number | null): { slotId: string | null; external: boolean } {
  if (trayNow === null || trayNow === 255) return { slotId: null, external: false };
  if (trayNow === 254) return { slotId: null, external: true };
  if (trayNow >= 80) return { slotId: null, external: false };
  return { slotId: String(trayNow & 0x3), external: false };
}

function readExternal(value: Json | undefined, active: boolean): LiveView["ams"]["external"] {
  if (!isPlain(value)) return null;
  const remain = num(value.remain);
  return {
    type: text(value.tray_type),
    color: swatch(value.tray_color),
    remain: remain !== null && remain >= 0 ? remain : null,
    active,
  };
}

function nozzleDiameter(print: Record<string, Json>): string | null {
  const direct = text(print.nozzle_diameter);
  if (direct) return direct;
  const info = nestedNozzle(print);
  return info ? text(info.diameter) ?? (num(info.diameter) !== null ? String(num(info.diameter)) : null) : null;
}

function nozzleType(print: Record<string, Json>): string | null {
  const direct = text(print.nozzle_type);
  const raw = direct ?? (nestedNozzle(print) ? text(nestedNozzle(print)?.type) : null);
  if (!raw || raw === "undef") return null;
  return NOZZLE_TYPES[raw] ?? raw;
}

function nestedNozzle(print: Record<string, Json>): Record<string, Json> | null {
  const device = print.device;
  if (!isPlain(device) || !isPlain(device.nozzle)) return null;
  const info = device.nozzle.info;
  if (!Array.isArray(info)) return null;
  const first = info.find(isPlain);
  return isPlain(first) ? first : null;
}

function isPlain(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
