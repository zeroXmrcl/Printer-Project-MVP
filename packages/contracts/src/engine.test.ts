import assert from "node:assert/strict";
import test from "node:test";
import { applyReport, emptyEngine, mergeFields, toLiveView, visibleHms, estimateWatts, integrateWh, verifyPassword, hashPassword } from "./index";
import type { PowerModel } from "./energy";

const power: PowerModel = {
  sources: ["https://wiki.bambulab.com/en/p2s/manual/p2s-faq"],
  mains: { "220": { maxW: 1200, steadyPlaW: 200 }, "110": { maxW: 1000, steadyPlaW: 200 } },
  standbyW: 8.2,
  standbyNote: "",
  ams2Pro: { standbyW: 1, workingW: 12, dryingW: 80 },
  bedHeatHysteresisC: 1,
  notModeled: [],
  rules: "",
};

test("partial reports merge field by field and ignore sequence order", () => {
  const first = mergeFields({}, { nozzle_temper: 200, sequence_id: 5, bed_temper: 40 });
  const second = mergeFields(first, { sequence_id: 4, bed_temper: 55 });
  assert.equal(second.nozzle_temper, 200);
  assert.equal(second.bed_temper, 55);
  assert.equal(second.sequence_id, 4);
});

test("jobs open on RUNNING, stay open on PAUSE, and close on FINISH, FAILED, or IDLE", () => {
  let engine = emptyEngine();
  let ids = 0;
  const id = () => `job_${++ids}`;
  ({ engine } = applyReport(engine, { gcode_state: "RUNNING", subtask_name: "a.3mf" }, 1_000, power, "220", id));
  assert.equal(engine.job?.id, "job_1");
  ({ engine } = applyReport(engine, { gcode_state: "PAUSE" }, 2_000, power, "220", id));
  assert.equal(engine.job?.result, "PAUSE");
  let closed = applyReport(engine, { gcode_state: "FINISH" }, 3_000, power, "220", id);
  assert.equal(closed.effects.find((effect) => effect.type === "job-close")?.type, "job-close");
  assert.equal(closed.engine.job, null);

  engine = emptyEngine();
  ({ engine } = applyReport(engine, { gcode_state: "RUNNING" }, 1_000, power, "220", id));
  closed = applyReport(engine, { gcode_state: "FAILED" }, 2_000, power, "220", id);
  assert.equal(closed.effects.find((effect) => effect.type === "job-close" && effect.job.result === "FAILED")?.type, "job-close");

  engine = emptyEngine();
  ({ engine } = applyReport(engine, { gcode_state: "RUNNING" }, 1_000, power, "220", id));
  closed = applyReport(engine, { gcode_state: "IDLE" }, 2_000, power, "220", id);
  const abort = closed.effects.find((effect) => effect.type === "job-close");
  assert.equal(abort && abort.type === "job-close" ? abort.job.result : "", "ABORTED");
});

test("telemetry is sampled at most every 5s, state changes immediately", () => {
  let engine = emptyEngine();
  const id = () => "job_t";
  let step = applyReport(engine, { gcode_state: "RUNNING", nozzle_temper: 200, mc_percent: 1 }, 0, power, "220", id);
  engine = step.engine;
  const first = step.effects.filter((effect) => effect.type === "sample");
  assert.equal(first.length, 1);
  step = applyReport(engine, { nozzle_temper: 201, mc_percent: 2 }, 1_000, power, "220", id);
  assert.equal(step.effects.some((effect) => effect.type === "sample"), false);
  step = applyReport(step.engine, { layer_num: 2 }, 1_500, power, "220", id);
  assert.equal(step.effects.some((effect) => effect.type === "sample" && effect.sample.reason === "state"), true);
  step = applyReport(step.engine, { nozzle_temper: 210 }, 7_000, power, "220", id);
  assert.equal(step.effects.some((effect) => effect.type === "sample" && effect.sample.reason === "telemetry"), true);
});

test("energy uses published bands and does not invent fan watts", () => {
  const heating = estimateWatts({ gcode_state: "RUNNING", bed_temper: 40, bed_target_temper: 65 }, power, "220");
  assert.equal(heating.watts, 1200);
  assert.equal(heating.basis, "bed-heat");
  const printing = estimateWatts(
    { gcode_state: "RUNNING", bed_temper: 80, bed_target_temper: 80, cooling_fan_speed: 15, ams: { ams: [{ temp: "30" }], tray_now: "0", tray_tar: "0" } },
    power,
    "220",
  );
  assert.equal(printing.watts, 201);
  const drying = estimateWatts(
    { gcode_state: "IDLE", bed_temper: 25, bed_target_temper: 0, ams: { ams: [{ dry_time: 20 }], tray_now: "255", tray_tar: "255" } },
    power,
    "220",
  );
  assert.equal(drying.watts, 88.2);
  assert.equal(estimateWatts({ gcode_state: "IDLE" }, null, "220").watts, null);
});

test("unknown HMS codes stay hidden", () => {
  const map = { source: "test", codes: { "0300-0100-0001-0003": { message: "Bed", wiki: "https://wiki.bambulab.com/en/hms/home" } } };
  const shown = visibleHms([{ attr: 0x03000100, code: 0x00010003 }, { attr: 1, code: 2 }], map);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].code, "0300-0100-0001-0003");
  assert.equal(shown[0].severity, "fatal");
});

test("stale after 15 seconds keeps the last values", () => {
  const live = toLiveView({
    print: { gcode_state: "RUNNING", mc_percent: 10, subtask_name: "a.3mf" },
    receivedAt: 0,
    pushallAt: 0,
    now: 16_000,
    coverUrl: null,
    cameraUrl: null,
    stages: { "0": "Printing" },
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
  assert.equal(live.stale, true);
  assert.equal(live.percent, 10);
  assert.equal(live.filename, "a.3mf");
});

test("the public report omits secrets and keeps printer fields", () => {
  const live = toLiveView({
    print: {
      gcode_state: "RUNNING",
      wifi_signal: "-48dBm",
      ipcam: { resolution: "1080p", timelapse: "enable" },
      print_error: 0,
      serial: "SECRET",
      ip: "10.0.0.8",
    },
    receivedAt: 1_000,
    pushallAt: 1_000,
    now: 1_100,
    coverUrl: null,
    cameraUrl: null,
    stages: {},
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
  const blob = JSON.stringify(live.facts);
  assert.match(blob, /1080p/);
  assert.match(blob, /-48dBm/);
  assert.equal(blob.includes("SECRET"), false);
  assert.equal(blob.includes("10.0.0.8"), false);
  assert.equal(live.printError, null);
});

test("chamber actual falls back to device.ctc.info.temp when chamber_temper is absent", () => {
  const live = toLiveView({
    print: {
      gcode_state: "IDLE",
      nozzle_temper: 24,
      bed_temper: 18,
      device: { ctc: { info: { temp: 22 } } },
    },
    receivedAt: 1_000,
    pushallAt: 1_000,
    now: 1_100,
    coverUrl: null,
    cameraUrl: null,
    stages: {},
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
  assert.equal(live.temps.chamber.actual, 22);
  assert.equal(live.temps.nozzle.actual, 24);
  assert.equal(live.temps.bed.actual, 18);
});

test("airflow and remain stay empty when the printer does not send them", () => {
  const live = toLiveView({
    print: { gcode_state: "IDLE", vt_tray: { tray_type: "TPU", remain: -1 } },
    receivedAt: 1_000,
    pushallAt: 1_000,
    now: 1_100,
    coverUrl: null,
    cameraUrl: null,
    stages: {},
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
  assert.equal(live.airflow, null);
  assert.equal(live.ams.external?.remain, null);
  assert.equal(live.ams.external?.type, "TPU");
  assert.equal(live.showBar, false);
});

test("password hash verifies and a wrong password does not", () => {
  const stored = hashPassword("correct horse battery");
  assert.equal(verifyPassword("correct horse battery", stored), true);
  assert.equal(verifyPassword("nope", stored), false);
});

test("watt samples integrate without filling long gaps", () => {
  const wh = integrateWh(
    [
      { at: 0, watts: 200 },
      { at: 3_600_000, watts: 200 },
    ],
    3_600_000,
  );
  const fiveMinutes = (200 * 5) / 60;
  assert.ok(wh !== null && Math.abs(wh - fiveMinutes) < 0.1);
});
