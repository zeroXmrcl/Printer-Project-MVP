import fs from "node:fs";
import path from "node:path";
import { insertMedia, insertSample, openDatabase, upsertJob, writeSettings, writeStatus } from "../packages/db/src/index.ts";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "data");
const mediaDir = path.join(dataDir, "media", "job_demo_done");
fs.mkdirSync(mediaDir, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#141414"/><circle cx="320" cy="180" r="70" fill="#9bb8a4"/></svg>`;
fs.writeFileSync(path.join(mediaDir, "1.svg"), svg);

const db = openDatabase(path.join(dataDir, "printcast.db"));
const now = Date.now();
const started = now - 3 * 60 * 60 * 1000;
upsertJob(db, {
  id: "job_demo_done",
  filename: "hinge-lid.3mf",
  openedAt: started,
  closedAt: now - 60_000,
  result: "FINISH",
  lastPercent: 100,
  lastLayer: 180,
  lastTotalLayers: 180,
});
for (let i = 0; i <= 12; i += 1) {
  insertSample(db, {
    jobId: "job_demo_done",
    at: started + i * 15 * 60_000,
    reason: "telemetry",
    nozzle: 200 + i,
    nozzleTarget: 240,
    bed: 40 + i * 3,
    bedTarget: 80,
    chamber: 28 + i,
    percent: i * 8,
    layer: i * 15,
    partFan: 8,
    auxFan: 4,
    heatbreakFan: 15,
    watts: i < 2 ? 1200 : 201,
    gcodeState: "RUNNING",
  });
}
insertMedia(db, "job_demo_done", "snapshot", "job_demo_done/1.svg", started);

const openStart = now - 20 * 60_000;
upsertJob(db, {
  id: "job_demo_open",
  filename: "bench-bracket.3mf",
  openedAt: openStart,
  closedAt: null,
  result: "RUNNING",
  lastPercent: 42,
  lastLayer: 86,
  lastTotalLayers: 240,
});
insertSample(db, {
  jobId: "job_demo_open",
  at: openStart,
  reason: "state",
  nozzle: 238,
  nozzleTarget: 240,
  bed: 80,
  bedTarget: 80,
  chamber: 36,
  percent: 42,
  layer: 86,
  partFan: 9,
  auxFan: 6,
  heatbreakFan: 15,
  watts: 201,
  gcodeState: "RUNNING",
});

writeStatus(
  db,
  {
    gcode_state: "RUNNING",
    subtask_name: "bench-bracket.3mf",
    mc_percent: 42,
    mc_remaining_time: 72,
    layer_num: 86,
    total_layer_num: 240,
    stg_cur: 0,
    nozzle_temper: 238,
    nozzle_target_temper: 240,
    bed_temper: 80,
    bed_target_temper: 80,
    chamber_temper: 36,
    cooling_fan_speed: 9,
    big_fan1_speed: 6,
    heatbreak_fan_speed: 15,
    spd_lvl: 2,
    spd_mag: 100,
    nozzle_diameter: "0.4",
    nozzle_type: "hardened_steel",
    wifi_signal: "-48dBm",
    lights_report: [{ node: "chamber_light", mode: "on" }],
    device: { airduct: { modeCur: 0 } },
    ams: {
      tray_now: "0",
      tray_tar: "0",
      ams: [{
        id: "0",
        temp: "32",
        humidity: "3",
        humidity_raw: "41",
        dry_time: 0,
        tray: [
          { id: "0", tray_type: "PETG", tray_color: "4C8DFFFF", remain: 72 },
          { id: "1", tray_type: "PLA", tray_color: "F2F2F2FF", remain: 40 },
          { id: "2", tray_type: "ASA", tray_color: "222222FF", remain: -1 },
          { id: "3", tray_type: "Support", tray_color: "D8B15AFF", remain: 90 },
        ],
      }],
    },
    vt_tray: { id: "254", tray_type: "TPU", remain: -1 },
    hms: [{ attr: 0x03000100, code: 0x00010003 }],
  },
  now,
  now - 60_000,
);
writeSettings(db, {
  title: "PrintCast",
  notes: "Bench printer",
  streamUrl: "",
  alwaysShowCamera: false,
  amsOwnSupply: false,
  mediamtxApiUrl: "",
  mediamtxPath: "printercam",
  mediamtxApiUser: "",
  mediamtxApiPassword: "",
});
console.log("Seeded data/printcast.db");
