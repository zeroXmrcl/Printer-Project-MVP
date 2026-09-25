import assert from "node:assert/strict";
import test from "node:test";
import { toLiveView } from "./index";
import type { Json } from "./json";
import type { PowerModel } from "./energy";

const power: PowerModel = {
  sources: [],
  mains: { "220": { maxW: 1200, steadyPlaW: 200 }, "110": { maxW: 1000, steadyPlaW: 200 } },
  standbyW: 8.2,
  standbyNote: "",
  ams2Pro: { standbyW: 1, workingW: 12, dryingW: 80 },
  bedHeatHysteresisC: 1,
  notModeled: [],
  rules: "",
};

function liveFrom(unit: Record<string, Json>, extra: Record<string, Json> = {}) {
  return toLiveView({
    print: {
      gcode_state: "IDLE",
      stg_cur: extra.stg_cur ?? 0,
      ams: { ams: [{ id: "0", dry_time: 0, tray: [], ...unit }], tray_now: "255" },
      ...extra,
    },
    receivedAt: 1_000,
    pushallAt: 1_000,
    now: 1_100,
    coverUrl: null,
    cameraUrl: null,
    stages: { "0": "Idle", "14": "Drying filament" },
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
}

test("AMS 2 Pro at 22% RH grades B from percent, not the MQTT index", () => {
  const live = liveFrom({ info: "10001003", humidity: "4", humidity_raw: "22", temp: "24.1" });
  assert.equal(live.ams.model, "AMS 2 Pro");
  assert.equal(live.ams.humidityPercent, 22);
  assert.equal(live.ams.humidityIndexMqtt, 4);
  assert.equal(live.ams.humidityIndexStudio, 2);
  assert.equal(live.ams.grade, "B");
  assert.equal(live.ams.gradeSource, "percent");
  assert.equal(live.ams.temperatureC, 24.1);
  assert.equal(live.facts.find((row) => row.label === "AMS grade")?.value, "B");
  assert.equal(live.facts.find((row) => row.label === "AMS humidity")?.value, "22%");
});

test("AMS 2 Pro at 23% RH is B", () => {
  const live = liveFrom({ info: "10001003", humidity: "4", humidity_raw: "23", temp: "31" });
  assert.equal(live.ams.grade, "B");
  assert.equal(live.ams.gradeSource, "percent");
  assert.notEqual(live.ams.grade, "D");
});

test("AMS 2 Pro percent bands C and D", () => {
  assert.equal(liveFrom({ info: "10001003", humidity_raw: "38", temp: "24" }).ams.grade, "C");
  assert.equal(liveFrom({ info: "10001003", humidity_raw: "48", temp: "24" }).ams.grade, "D");
});

test("original AMS inverts the MQTT index", () => {
  const dry = liveFrom({ info: "10001001", humidity: "5" });
  assert.equal(dry.ams.model, "AMS");
  assert.equal(dry.ams.humidityPercent, null);
  assert.equal(dry.ams.grade, "A");
  assert.equal(dry.ams.gradeSource, "index_inverted");
  assert.equal(dry.ams.humidityIndexStudio, 1);

  const wet = liveFrom({ info: "10001001", humidity: "1" });
  assert.equal(wet.ams.grade, "E");
  assert.equal(wet.ams.gradeSource, "index_inverted");
});

test("humidity_raw that repeats the 1–5 index is not a percent", () => {
  const live = liveFrom({ info: "10001001", humidity: "4", humidity_raw: "4" });
  assert.equal(live.ams.humidityPercent, null);
  assert.equal(live.ams.grade, "B");
  assert.equal(live.ams.gradeSource, "index_inverted");
  assert.equal(live.facts.find((row) => row.label === "AMS humidity"), undefined);
});

test("dry_time 0 keeps drying off even when a stage name says Drying", () => {
  const live = liveFrom({ info: "10001003", humidity_raw: "22", humidity: "4" }, { stg_cur: 14 });
  assert.equal(live.stageLabel, "Drying filament");
  assert.equal(live.ams.drying, false);
  assert.equal(live.ams.dryRemainingMin, null);
});
