import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { integrateWh, toLiveView, type JobRecord, type Json, type LiveView } from "@printcast/contracts";
import { dryRemainingRatio, nextDryBaseline } from "./dry-cycle";
import {
  firstSnapshot,
  getJob,
  latestJob,
  listAudit,
  listJobs,
  listMedia,
  listSamples,
  openDatabase,
  openJob,
  readModels,
  readSettings,
  readStatus,
  type AuditRow,
  type MediaRow,
  type SampleRow,
} from "@printcast/db";

const globalStore = globalThis as typeof globalThis & { __printcastDb?: DatabaseSync };

export function repoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "../..")];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "config", "power-model.json"))) ?? process.cwd();
}

export function dataDir(): string {
  return process.env.PRINTCAST_DATA ?? path.join(repoRoot(), "data");
}

export function database(): DatabaseSync {
  if (!globalStore.__printcastDb) {
    globalStore.__printcastDb = openDatabase(path.join(dataDir(), "printcast.db"));
  }
  return globalStore.__printcastDb;
}

export function currentLive(): LiveView {
  const db = database();
  const status = readStatus(db);
  const settings = readSettings(db);
  const models = readModels(process.env.CONFIG_DIR ?? path.join(repoRoot(), "config"));
  const print = JSON.parse(status.payload || "{}") as Record<string, Json>;
  const coverJob = openJob(db) ?? latestJob(db);
  const snap = coverJob ? firstSnapshot(db, coverJob.id) : null;
  const view = toLiveView({
    print,
    receivedAt: status.received_at,
    pushallAt: status.pushall_at,
    now: Date.now(),
    coverUrl: snap ? `/api/media/${snap.rel_path}` : null,
    cameraUrl: settings.streamUrl || process.env.PUBLIC_HLS_URL || null,
    stages: models.stages,
    hms: models.hms,
    power: models.power,
    mains: process.env.PRINTCAST_MAINS,
    deviceNameHint: readCachedDeviceName() ?? readConfiguredDeviceName(),
  });
  if (view.deviceName) writeCachedDeviceName(view.deviceName);
  return view;
}

function dryCyclePath(): string {
  return path.join(dataDir(), "dry-cycle.json");
}

function readDryBaseline(): number | null {
  try {
    const raw = JSON.parse(fs.readFileSync(dryCyclePath(), "utf8")) as { baselineMin?: unknown };
    return typeof raw.baselineMin === "number" && raw.baselineMin > 0 ? raw.baselineMin : null;
  } catch {
    return null;
  }
}

function rememberDryCycle(live: LiveView): number | null {
  const drying = live.ams.drying === true;
  const remaining = drying ? live.ams.dryRemainingMin : null;
  const previous = readDryBaseline();
  const baseline = nextDryBaseline(previous, remaining, drying);
  if (baseline !== previous) {
    try {
      if (baseline === null) fs.rmSync(dryCyclePath(), { force: true });
      else {
        fs.mkdirSync(dataDir(), { recursive: true });
        fs.writeFileSync(dryCyclePath(), JSON.stringify({ baselineMin: baseline }));
      }
    } catch {
      /* The ring still uses this request's baseline if the file cannot be saved. */
    }
  }
  return dryRemainingRatio(baseline, remaining);
}

function deviceNamePath(): string {
  return path.join(dataDir(), "device-name");
}

function readCachedDeviceName(): string | null {
  try {
    const value = fs.readFileSync(deviceNamePath(), "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeCachedDeviceName(name: string): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(deviceNamePath(), name);
  } catch {
    /* ignore cache write failures */
  }
}

function readConfiguredDeviceName(): string | null {
  try {
    const file = path.join(process.env.CONFIG_DIR ?? path.join(repoRoot(), "config"), "printer.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { deviceName?: unknown };
    return typeof raw.deviceName === "string" && raw.deviceName.trim() ? raw.deviceName.trim() : null;
  } catch {
    return null;
  }
}

export type BoardJob = Pick<JobRecord, "id" | "filename" | "openedAt" | "closedAt" | "result" | "lastPercent">;
export type BoardPoint = { nozzle: number | null; bed: number | null; percent: number | null };
export type BoardFrame = { id: number; kind: string; path: string; at: number };
export type BoardPhoto = { name: string; url: string };
export type BoardSnapshot = {
  live: LiveView;
  alwaysShowCamera: boolean;
  amsOwnSupply: boolean;
  showAmsGrade: boolean;
  dryRemainingRatio: number | null;
  jobs: BoardJob[];
  curve: BoardPoint[];
  kwh: number | null;
  frames: BoardFrame[];
  photos: BoardPhoto[];
};

export function dashboard(): BoardSnapshot {
  const db = database();
  const live = currentLive();
  const display = readSettings(db);
  const open = openJob(db);
  const series = open ? listSamples(db, open.id) : [];
  const wh = open ? integrateWh(series.map((sample) => ({ at: sample.at, watts: sample.watts })), open.closedAt ?? Date.now()) : null;
  return {
    live,
    alwaysShowCamera: display.alwaysShowCamera,
    amsOwnSupply: display.amsOwnSupply,
    showAmsGrade: display.showAmsGrade,
    dryRemainingRatio: rememberDryCycle(live),
    jobs: listJobs(db, 8).map((job) => ({
      id: job.id,
      filename: job.filename,
      openedAt: job.openedAt,
      closedAt: job.closedAt,
      result: job.result,
      lastPercent: job.lastPercent,
    })),
    curve: downsample(series.map((sample) => ({ nozzle: sample.nozzle, bed: sample.bed, percent: sample.percent }))),
    kwh: wh,
    frames: (open ? listMedia(db, open.id) : []).slice(-8).map((item) => ({
      id: item.id,
      kind: item.kind,
      path: item.rel_path,
      at: item.at,
    })),
    photos: printerPhotos(),
  };
}

export function settings() {
  return readSettings(database());
}

function downsample<T>(rows: T[], max = 160): T[] {
  if (rows.length <= max) return rows;
  const stride = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % stride === 0 || index === rows.length - 1);
}

function printerPhotos(): BoardPhoto[] {
  const dir = path.join(dataDir(), "photos");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.includes("..") && !name.includes("/") && !name.includes("\\") && /\.(png|jpe?g|webp)$/i.test(name))
    .sort()
    .map((name) => ({ name, url: `/api/photos/${encodeURIComponent(name)}` }));
}

export function jobs(): JobRecord[] {
  return listJobs(database());
}

export function job(id: string): JobRecord | null {
  return getJob(database(), id);
}

export function samples(jobId: string): SampleRow[] {
  return listSamples(database(), jobId);
}

export function media(jobId: string): MediaRow[] {
  return listMedia(database(), jobId);
}

export function audit(): AuditRow[] {
  return listAudit(database());
}
