import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { HmsMap, JobRecord, PowerModel, SampleRecord } from "@printcast/contracts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS printer_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL DEFAULT '{}',
  received_at INTEGER,
  pushall_at INTEGER
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  filename TEXT,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  result TEXT NOT NULL,
  last_percent REAL,
  last_layer INTEGER,
  last_total_layers INTEGER
);
CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  at INTEGER NOT NULL,
  reason TEXT NOT NULL,
  nozzle REAL,
  nozzle_target REAL,
  bed REAL,
  bed_target REAL,
  chamber REAL,
  percent REAL,
  layer INTEGER,
  part_fan REAL,
  aux_fan REAL,
  heatbreak_fan REAL,
  watts REAL,
  gcode_state TEXT
);
CREATE INDEX IF NOT EXISTS samples_job_at ON samples(job_id, at);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  kind TEXT NOT NULL,
  rel_path TEXT NOT NULL UNIQUE,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS display_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  ok INTEGER NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
`;

export type StatusRow = { payload: string; received_at: number | null; pushall_at: number | null };
export type Settings = { title: string; notes: string; streamUrl: string; alwaysShowCamera: boolean; amsOwnSupply: boolean };
export type AuditRow = { id: number; at: number; action: string; ok: number; detail: string };
export type MediaRow = { id: number; job_id: string; kind: string; rel_path: string; at: number };
export type SampleRow = {
  id: number;
  job_id: string;
  at: number;
  reason: string;
  nozzle: number | null;
  nozzle_target: number | null;
  bed: number | null;
  bed_target: number | null;
  chamber: number | null;
  percent: number | null;
  layer: number | null;
  part_fan: number | null;
  aux_fan: number | null;
  heatbreak_fan: number | null;
  watts: number | null;
  gcode_state: string | null;
};

export function openDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const columns = db.prepare("PRAGMA table_info(display_settings)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "always_show_camera")) {
    db.exec("ALTER TABLE display_settings ADD COLUMN always_show_camera INTEGER NOT NULL DEFAULT 0");
  }
  const nextColumns = db.prepare("PRAGMA table_info(display_settings)").all() as { name: string }[];
  if (!nextColumns.some((column) => column.name === "ams_own_supply")) {
    db.exec("ALTER TABLE display_settings ADD COLUMN ams_own_supply INTEGER NOT NULL DEFAULT 0");
  }
  db.prepare(
    "INSERT INTO printer_status (id, payload) VALUES (1, '{}') ON CONFLICT(id) DO NOTHING",
  ).run();
  db.prepare(
    "INSERT INTO display_settings (id, title, notes, stream_url) VALUES (1, 'PrintCast', '', '') ON CONFLICT(id) DO NOTHING",
  ).run();
  return db;
}

export function readStatus(db: DatabaseSync): StatusRow {
  return db.prepare("SELECT payload, received_at, pushall_at FROM printer_status WHERE id = 1").get() as StatusRow;
}

export function writeStatus(db: DatabaseSync, payload: unknown, receivedAt: number | null, pushallAt: number | null): void {
  db.prepare("UPDATE printer_status SET payload = ?, received_at = ?, pushall_at = ? WHERE id = 1").run(
    JSON.stringify(payload),
    receivedAt,
    pushallAt,
  );
}

export function upsertJob(db: DatabaseSync, job: JobRecord): void {
  db.prepare(
    `INSERT INTO jobs (id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       filename = excluded.filename,
       closed_at = excluded.closed_at,
       result = excluded.result,
       last_percent = excluded.last_percent,
       last_layer = excluded.last_layer,
       last_total_layers = excluded.last_total_layers`,
  ).run(job.id, job.filename, job.openedAt, job.closedAt, job.result, job.lastPercent, job.lastLayer, job.lastTotalLayers);
}

export function insertSample(db: DatabaseSync, sample: SampleRecord): void {
  db.prepare(
    `INSERT INTO samples (
      job_id, at, reason, nozzle, nozzle_target, bed, bed_target, chamber, percent, layer,
      part_fan, aux_fan, heatbreak_fan, watts, gcode_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sample.jobId,
    sample.at,
    sample.reason,
    sample.nozzle,
    sample.nozzleTarget,
    sample.bed,
    sample.bedTarget,
    sample.chamber,
    sample.percent,
    sample.layer,
    sample.partFan,
    sample.auxFan,
    sample.heatbreakFan,
    sample.watts,
    sample.gcodeState,
  );
}

export function insertMedia(db: DatabaseSync, jobId: string, kind: string, relPath: string, at: number): void {
  db.prepare("INSERT OR IGNORE INTO media (job_id, kind, rel_path, at) VALUES (?, ?, ?, ?)").run(jobId, kind, relPath, at);
}

export function listJobs(db: DatabaseSync, limit = 50): JobRecord[] {
  const rows = db
    .prepare(
      "SELECT id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers FROM jobs ORDER BY opened_at DESC LIMIT ?",
    )
    .all(limit) as JobRow[];
  return rows.map(toJob);
}

export function getJob(db: DatabaseSync, id: string): JobRecord | null {
  const row = db
    .prepare(
      "SELECT id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers FROM jobs WHERE id = ?",
    )
    .get(id) as JobRow | undefined;
  return row ? toJob(row) : null;
}

export function openJob(db: DatabaseSync): JobRecord | null {
  const row = db
    .prepare(
      "SELECT id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers FROM jobs WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1",
    )
    .get() as JobRow | undefined;
  return row ? toJob(row) : null;
}

export function latestJob(db: DatabaseSync): JobRecord | null {
  const row = db
    .prepare(
      "SELECT id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers FROM jobs ORDER BY opened_at DESC LIMIT 1",
    )
    .get() as JobRow | undefined;
  return row ? toJob(row) : null;
}

export function listSamples(db: DatabaseSync, jobId: string): SampleRow[] {
  return db.prepare("SELECT * FROM samples WHERE job_id = ? ORDER BY at ASC").all(jobId) as SampleRow[];
}

export function listMedia(db: DatabaseSync, jobId: string): MediaRow[] {
  return db.prepare("SELECT * FROM media WHERE job_id = ? ORDER BY at ASC").all(jobId) as MediaRow[];
}

export function latestSnapshotAt(db: DatabaseSync, jobId: string): number | null {
  const row = db
    .prepare("SELECT at FROM media WHERE job_id = ? AND kind = 'snapshot' ORDER BY at DESC LIMIT 1")
    .get(jobId) as { at: number } | undefined;
  return row?.at ?? null;
}

export function firstSnapshot(db: DatabaseSync, jobId: string): MediaRow | null {
  return (
    (db
      .prepare("SELECT * FROM media WHERE job_id = ? AND kind = 'snapshot' ORDER BY at ASC LIMIT 1")
      .get(jobId) as MediaRow | undefined) ?? null
  );
}

export function hasTimelapse(db: DatabaseSync, jobId: string): boolean {
  const row = db.prepare("SELECT id FROM media WHERE job_id = ? AND kind = 'timelapse' LIMIT 1").get(jobId) as
    | { id: number }
    | undefined;
  return Boolean(row);
}

export function jobsNeedingTimelapse(db: DatabaseSync, since: number): JobRecord[] {
  const rows = db
    .prepare(
      `SELECT id, filename, opened_at, closed_at, result, last_percent, last_layer, last_total_layers
       FROM jobs
       WHERE result = 'FINISH' AND closed_at >= ?
         AND NOT EXISTS (SELECT 1 FROM media WHERE media.job_id = jobs.id AND media.kind = 'timelapse')
       ORDER BY closed_at ASC`,
    )
    .all(since) as JobRow[];
  return rows.map(toJob);
}

export function readSettings(db: DatabaseSync): Settings {
  const row = db.prepare("SELECT title, notes, stream_url, always_show_camera, ams_own_supply FROM display_settings WHERE id = 1").get() as {
    title: string;
    notes: string;
    stream_url: string;
    always_show_camera: number;
    ams_own_supply: number;
  };
  return {
    title: row.title,
    notes: row.notes,
    streamUrl: row.stream_url,
    alwaysShowCamera: row.always_show_camera === 1,
    amsOwnSupply: row.ams_own_supply === 1,
  };
}

export function writeSettings(db: DatabaseSync, settings: Settings): void {
  db.prepare("UPDATE display_settings SET title = ?, notes = ?, stream_url = ?, always_show_camera = ?, ams_own_supply = ? WHERE id = 1").run(
    settings.title,
    settings.notes,
    settings.streamUrl,
    settings.alwaysShowCamera ? 1 : 0,
    settings.amsOwnSupply ? 1 : 0,
  );
}

export function insertAudit(db: DatabaseSync, action: string, ok: boolean, detail: string, at = Date.now()): void {
  db.prepare("INSERT INTO audit_log (at, action, ok, detail) VALUES (?, ?, ?, ?)").run(at, action, ok ? 1 : 0, detail);
}

export function listAudit(db: DatabaseSync, limit = 20): AuditRow[] {
  return db.prepare("SELECT id, at, action, ok, detail FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as AuditRow[];
}

export function readModels(configDir: string): { power: PowerModel | null; hms: HmsMap; stages: Record<string, string> } {
  return {
    power: readJson(path.join(configDir, "power-model.json")) as PowerModel | null,
    hms: (readJson(path.join(configDir, "hms-map.json")) as HmsMap | null) ?? { source: "", codes: {} },
    stages: ((readJson(path.join(configDir, "stage-map.json")) as { stages?: Record<string, string> } | null)?.stages) ?? {},
  };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

type JobRow = {
  id: string;
  filename: string | null;
  opened_at: number;
  closed_at: number | null;
  result: string;
  last_percent: number | null;
  last_layer: number | null;
  last_total_layers: number | null;
};

function toJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    filename: row.filename,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    result: row.result,
    lastPercent: row.last_percent,
    lastLayer: row.last_layer,
    lastTotalLayers: row.last_total_layers,
  };
}
