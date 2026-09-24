import assert from "node:assert/strict";
import test from "node:test";
import { clearLoginFailureRows, insertLoginFailure, insertSample, openDatabase, readSettings, recentLoginFailures, upsertJob, writeSettings } from "./index";
import { revertMigration } from "./migrations";

test("sqlite keeps a job, a sample, and display settings", () => {
  const db = openDatabase(":memory:");
  upsertJob(db, {
    id: "job_1",
    filename: "part.3mf",
    openedAt: 10,
    closedAt: null,
    result: "RUNNING",
    lastPercent: 4,
    lastLayer: 1,
    lastTotalLayers: 10,
  });
  insertSample(db, {
    jobId: "job_1",
    at: 10,
    reason: "state",
    nozzle: 200,
    nozzleTarget: 210,
    bed: 50,
    bedTarget: 60,
    chamber: 30,
    percent: 4,
    layer: 1,
    partFan: 8,
    auxFan: 0,
    heatbreakFan: 15,
    watts: 1200,
    gcodeState: "RUNNING",
  });
  assert.equal(readSettings(db).alwaysShowCamera, false);
  assert.equal(readSettings(db).amsOwnSupply, false);
  writeSettings(db, {
    title: "Bench",
    notes: "Quiet",
    streamUrl: "https://stream.example/p2s/index.m3u8",
    alwaysShowCamera: true,
    amsOwnSupply: true,
    mediamtxApiUrl: "http://192.168.1.8:9997",
    mediamtxPath: "printercam",
    mediamtxApiUser: "",
    mediamtxApiPassword: "",
  });
  const settings = readSettings(db);
  assert.equal(settings.title, "Bench");
  assert.equal(settings.streamUrl, "https://stream.example/p2s/index.m3u8");
  assert.equal(settings.alwaysShowCamera, true);
  assert.equal(settings.amsOwnSupply, true);
  assert.equal(settings.mediamtxApiUrl, "http://192.168.1.8:9997");
  assert.equal(settings.mediamtxPath, "printercam");
  insertLoginFailure(db, "10.0.0.8", 1_000);
  insertLoginFailure(db, "10.0.0.8", 2_000);
  assert.equal(recentLoginFailures(db, "10.0.0.8", 3_000), 2);
  clearLoginFailureRows(db, "10.0.0.8");
  assert.equal(recentLoginFailures(db, "10.0.0.8", 3_000), 0);
  revertMigration(db, "003_login_failures");
  assert.equal(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'login_failures'").get() as { name: string } | undefined),
    undefined,
  );
});
