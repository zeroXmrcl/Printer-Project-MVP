import fs from "node:fs";
import path from "node:path";
import mqtt from "mqtt";
import { applyReport, emptyEngine, log, markPushall, nextBackoff, readPrint, type Engine, type Effect } from "@printcast/contracts";
import { insertSample, openDatabase, openJob, readModels, readStatus, upsertJob, writeStatus } from "@printcast/db";

const repoRoot = [process.cwd(), path.resolve(process.cwd(), "../..")].find((dir) =>
  fs.existsSync(path.join(dir, "config", "power-model.json")),
) ?? process.cwd();

const dataDir = process.env.PRINTCAST_DATA ?? path.join(repoRoot, "data");
const configDir = process.env.CONFIG_DIR ?? path.join(repoRoot, "config");
const db = openDatabase(path.join(dataDir, "printcast.db"));
const models = readModels(configDir);
const mains = process.env.PRINTCAST_MAINS;

const status = readStatus(db);
let engine: Engine = {
  ...emptyEngine(),
  print: JSON.parse(status.payload || "{}"),
  receivedAt: status.received_at,
  pushallAt: status.pushall_at,
  job: openJob(db),
};

const ip = process.env.PRINTER_IP ?? "";
const serial = process.env.PRINTER_SERIAL ?? "";
const accessCode = process.env.PRINTER_ACCESS_CODE ?? "";

if (!ip || !serial || !accessCode) {
  log("error", "missing_printer_env");
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });
setInterval(() => fs.writeFileSync(path.join(dataDir, "ingest-heartbeat"), String(Date.now())), 5_000).unref();
fs.writeFileSync(path.join(dataDir, "ingest-heartbeat"), String(Date.now()));

let delay = 1_000;
let generation = 0;
let stopped = false;

function persist(effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.type === "job-open" || effect.type === "job-update" || effect.type === "job-close") upsertJob(db, effect.job);
    if (effect.type === "sample") insertSample(db, effect.sample);
  }
  writeStatus(db, engine.print, engine.receivedAt, engine.pushallAt);
}

function connect(): void {
  const gen = ++generation;
  const client = mqtt.connect({
    host: ip,
    port: 8883,
    protocol: "mqtts",
    username: "bblp",
    password: accessCode,
    rejectUnauthorized: false,
    reconnectPeriod: 0,
    connectTimeout: 10_000,
    clientId: `printcast_${process.pid}_${gen}`,
  });

  client.on("connect", () => {
    delay = 1_000;
    client.subscribe(`device/${serial}/report`, { qos: 1 }, (error) => {
      if (error) log("warn", "mqtt_subscribe_failed", { message: error.message });
    });
    const now = Date.now();
    engine = markPushall(engine, now);
    writeStatus(db, engine.print, engine.receivedAt, engine.pushallAt);
    client.publish(
      `device/${serial}/request`,
      JSON.stringify({ pushing: { sequence_id: String(now), command: "pushall", version: 1, push_target: 1 } }),
      { qos: 1 },
    );
    log("info", "mqtt_connected");
  });

  client.on("message", (_topic, body) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString());
    } catch {
      log("warn", "mqtt_bad_json");
      return;
    }
    const print = readPrint(parsed);
    if (!print) return;
    const result = applyReport(engine, print, Date.now(), models.power, mains);
    engine = result.engine;
    persist(result.effects);
  });

  client.on("error", (error) => log("warn", "mqtt_error", { message: error.message }));
  client.on("close", () => {
    if (stopped || gen !== generation) return;
    const wait = delay;
    delay = nextBackoff(delay);
    log("warn", "mqtt_closed", { retryMs: wait });
    setTimeout(() => {
      if (stopped || gen !== generation) return;
      client.removeAllListeners();
      client.end(true);
      connect();
    }, wait);
  });
}

process.on("SIGTERM", () => {
  stopped = true;
  process.exit(0);
});

connect();
log("info", "ingest_started");
