import assert from "node:assert/strict";
import test from "node:test";
import { insertSample, openDatabase, readSettings, upsertJob, writeSettings } from "./index";

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
  writeSettings(db, { title: "Bench", notes: "Quiet", streamUrl: "https://stream.example/p2s/index.m3u8" });
  const settings = readSettings(db);
  assert.equal(settings.title, "Bench");
  assert.equal(settings.streamUrl, "https://stream.example/p2s/index.m3u8");
});
