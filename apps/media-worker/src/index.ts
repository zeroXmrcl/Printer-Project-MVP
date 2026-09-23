import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Client } from "basic-ftp";
import { log, SNAPSHOT_MS, type Json } from "@printcast/contracts";
import { hasTimelapse, insertMedia, jobsNeedingTimelapse, latestSnapshotAt, openDatabase, openJob, readStatus } from "@printcast/db";
import { chooseTimelapse } from "./files";

const repoRoot = [process.cwd(), path.resolve(process.cwd(), "../..")].find((dir) =>
  fs.existsSync(path.join(dir, "config", "power-model.json")),
) ?? process.cwd();
const dataDir = process.env.PRINTCAST_DATA ?? path.join(repoRoot, "data");
const mediaRoot = path.join(dataDir, "media");
const db = openDatabase(path.join(dataDir, "printcast.db"));
const rtspUrl = process.env.MEDIAMTX_RTSP_URL ?? "";
const ip = process.env.PRINTER_IP ?? "";
const accessCode = process.env.PRINTER_ACCESS_CODE ?? "";

fs.mkdirSync(mediaRoot, { recursive: true });
setInterval(() => {
  fs.writeFileSync(path.join(dataDir, "media-heartbeat"), String(Date.now()));
  logDisk();
}, 5_000).unref();
fs.writeFileSync(path.join(dataDir, "media-heartbeat"), String(Date.now()));

let lastDiskLog = 0;
function logDisk(): void {
  const now = Date.now();
  if (now - lastDiskLog < 5 * 60_000) return;
  lastDiskLog = now;
  try {
    const stat = fs.statfsSync(dataDir);
    log("info", "disk_free", { freeBytes: stat.bavail * stat.bsize });
  } catch (error) {
    log("warn", "disk_free_failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}

async function tick(): Promise<void> {
  const status = readStatus(db);
  const print = JSON.parse(status.payload || "{}") as Record<string, Json>;
  const state = String(print.gcode_state ?? "").toUpperCase();
  const job = openJob(db);
  if (state === "RUNNING" && job && rtspUrl) {
    const last = latestSnapshotAt(db, job.id) ?? 0;
    if (Date.now() - last >= SNAPSHOT_MS) await takeSnapshot(job.id);
  }
  if (ip && accessCode) await pullTimelapses();
}

async function takeSnapshot(jobId: string): Promise<void> {
  const at = Date.now();
  const rel = `${jobId}/${at}.jpg`;
  const dest = path.join(mediaRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    await runFfmpeg(rtspUrl, dest);
    insertMedia(db, jobId, "snapshot", rel, at);
    log("info", "snapshot_saved", { jobId });
  } catch (error) {
    log("warn", "snapshot_failed", { message: error instanceof Error ? error.message : "unknown" });
    fs.rmSync(dest, { force: true });
  }
}

function runFfmpeg(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-q:v", "3", dest],
      { signal: AbortSignal.timeout(20_000) },
    );
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `ffmpeg ${code}`))));
  });
}

async function pullTimelapses(): Promise<void> {
  const jobs = jobsNeedingTimelapse(db, Date.now() - 15 * 60_000);
  if (jobs.length === 0) return;
  const client = new Client(20_000);
  try {
    await client.access({
      host: ip,
      port: 990,
      user: "bblp",
      password: accessCode,
      secure: "implicit",
      secureOptions: { rejectUnauthorized: false },
    });
    await client.cd("/timelapse");
    const listed = await client.list();
    for (const job of jobs) {
      if (hasTimelapse(db, job.id)) continue;
      const chosen = chooseTimelapse(
        listed.map((file) => ({ name: file.name, modifiedAt: file.modifiedAt?.getTime() ?? null })),
        job.openedAt,
      );
      if (!chosen) continue;
      const rel = `${job.id}/${chosen.modifiedAt ?? Date.now()}-${path.basename(chosen.name)}`;
      const dest = path.join(mediaRoot, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await client.downloadTo(dest, chosen.name);
      insertMedia(db, job.id, "timelapse", rel, Date.now());
      log("info", "timelapse_saved", { jobId: job.id });
    }
  } catch (error) {
    log("warn", "timelapse_failed", { message: error instanceof Error ? error.message : "unknown" });
  } finally {
    client.close();
  }
}

setInterval(() => {
  void tick();
}, 5_000);
void tick();
log("info", "media_started", { snapshots: Boolean(rtspUrl) });
