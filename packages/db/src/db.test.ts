import assert from "node:assert/strict";
import test from "node:test";
import { clearLoginFailureRows, finalSnapshotPaths, insertLoginFailure, insertMedia, insertSample, mediaKindByPath, openDatabase, readSettings, recentLoginFailures, upsertJob, writeSettings } from "./index";
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
  assert.equal(readSettings(db).showAmsGrade, false);
  writeSettings(db, {
    title: "Bench",
    notes: "Quiet",
    streamUrl: "https://stream.example/p2s/index.m3u8",
    alwaysShowCamera: true,
    amsOwnSupply: true,
    showAmsGrade: true,
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
  assert.equal(settings.showAmsGrade, true);
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

test("a public still is the last snapshot of a closed job", () => {
  const db = openDatabase(":memory:");
  const job = {
    lastPercent: 100,
    lastLayer: 4,
    lastTotalLayers: 4,
  };
  upsertJob(db, { ...job, id: "job_open", filename: "open.3mf", openedAt: 1, closedAt: null, result: "RUNNING", lastPercent: 10 });
  upsertJob(db, { ...job, id: "job_done", filename: "done.3mf", openedAt: 1, closedAt: 30, result: "FINISH" });
  upsertJob(db, { ...job, id: "job_older", filename: "older.3mf", openedAt: 1, closedAt: 12, result: "FAILED" });
  insertMedia(db, "job_open", "snapshot", "job_open/1.jpg", 2);
  insertMedia(db, "job_done", "snapshot", "job_done/1.jpg", 10);
  insertMedia(db, "job_done", "snapshot", "job_done/2.jpg", 20);
  insertMedia(db, "job_done", "timelapse", "job_done/lap.mp4", 21);
  insertMedia(db, "job_older", "snapshot", "job_older/1.jpg", 11);
  assert.deepEqual(finalSnapshotPaths(db), ["job_done/2.jpg", "job_older/1.jpg"]);
  assert.equal(mediaKindByPath(db, "job_done/lap.mp4"), "timelapse");
  assert.equal(mediaKindByPath(db, "job_done/1.jpg"), "snapshot");
  assert.equal(mediaKindByPath(db, "missing.jpg"), null);
});
