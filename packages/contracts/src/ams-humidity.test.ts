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

test("AMS 2 Pro letter follows the inverted humidity index, not the percent", () => {
  const live = liveFrom({ info: "10001003", humidity: "4", humidity_raw: "22", temp: "24.1" });
  assert.equal(live.ams.model, "AMS 2 Pro");
  assert.equal(live.ams.humidityPercent, 22);
  assert.equal(live.ams.humidityIndexMqtt, 4);
  assert.equal(live.ams.humidityIndexStudio, 2);
  assert.equal(live.ams.grade, "B");
  assert.equal(live.ams.gradeSource, "index_inverted");
  assert.equal(live.ams.temperatureC, 24.1);
  assert.equal(live.facts.find((row) => row.label === "AMS grade")?.value, "B");
  assert.equal(live.facts.find((row) => row.label === "AMS humidity")?.value, "22%");
});

test("a higher percent does not override the AMS index", () => {
  const live = liveFrom({ info: "10001003", humidity: "4", humidity_raw: "38", temp: "24" });
  assert.equal(live.ams.humidityPercent, 38);
  assert.equal(live.ams.grade, "B");
  assert.equal(live.ams.gradeSource, "index_inverted");
});

test("AMS 2 Pro without an index has no letter", () => {
  const live = liveFrom({ info: "10001003", humidity_raw: "48", temp: "24" });
  assert.equal(live.ams.humidityPercent, 48);
  assert.equal(live.ams.grade, null);
  assert.equal(live.ams.gradeSource, null);
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

test("filament change exposes from and to slot labels and colors", () => {
  const live = toLiveView({
    print: {
      gcode_state: "RUNNING",
      layer_num: 86,
      total_layer_num: 240,
      stg_cur: 4,
      ams: {
        tray_now: "0",
        tray_tar: "3",
        ams: [{
          id: "0",
          info: "10001003",
          dry_time: 0,
          tray: [
            { id: "0", tray_type: "PETG", tray_color: "4C8DFFFF", remain: 72 },
            { id: "1", tray_type: "PLA", tray_color: "F2F2F2FF", remain: 40 },
            { id: "2", tray_type: "ASA", tray_color: "222222FF", remain: -1 },
            { id: "3", tray_type: "Support", tray_color: "D8B15AFF", remain: 90 },
          ],
        }],
      },
    },
    receivedAt: 1_000,
    pushallAt: 1_000,
    now: 1_100,
    coverUrl: null,
    cameraUrl: null,
    stages: { "4": "Changing filament" },
    hms: { source: "", codes: {} },
    power,
    mains: "220",
  });
  assert.deepEqual(live.ams.filamentChange, {
    from: { label: "A1", color: "#4C8DFF" },
    to: { label: "A4", color: "#D8B15A" },
  });
  assert.equal(live.stageLabel, "Changing filament");
});

test("matching tray_now and tray_tar means no filament change", () => {
  const same = toLiveView({
    print: {
      gcode_state: "RUNNING",
      ams: {
        tray_now: "0",
        tray_tar: "0",
        ams: [{
          id: "0",
          dry_time: 0,
          tray: [{ id: "0", tray_type: "PETG", tray_color: "4C8DFFFF", remain: 72 }],
        }],
      },
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
  assert.equal(same.ams.filamentChange, null);
});

test("filament change can target the external spool as EXT", () => {
  const live = toLiveView({
    print: {
      gcode_state: "RUNNING",
      ams: {
        tray_now: "1",
        tray_tar: "254",
        ams: [{
          id: "0",
          dry_time: 0,
          tray: [
            { id: "0", tray_type: "PETG", tray_color: "4C8DFFFF", remain: 72 },
            { id: "1", tray_type: "PLA", tray_color: "F2F2F2FF", remain: 40 },
          ],
        }],
      },
      vt_tray: { tray_type: "TPU", tray_color: "00AA88FF", remain: 50 },
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
  assert.deepEqual(live.ams.filamentChange, {
    from: { label: "A2", color: "#F2F2F2" },
    to: { label: "EXT", color: "#00AA88" },
  });
});

test("dry_setting fills filament, temperature, and duration hours", () => {
  const live = liveFrom({
    info: "10001003",
    dry_time: 500,
    dry_setting: {
      dry_filament: "PETG",
      dry_temperature: 65,
      dry_duration: 12,
    },
  });
  assert.equal(live.ams.drying, true);
  assert.equal(live.ams.dryRemainingMin, 500);
  assert.equal(live.ams.dryFilament, "PETG");
  assert.equal(live.ams.dryTemperatureC, 65);
  assert.equal(live.ams.dryDurationHours, 12);
});

test("dry_setting zeros and blanks stay null", () => {
  const live = liveFrom({
    dry_time: 10,
    dry_setting: {
      dry_filament: "",
      dry_temperature: 0,
      dry_duration: -1,
    },
  });
  assert.equal(live.ams.dryFilament, null);
  assert.equal(live.ams.dryTemperatureC, null);
  assert.equal(live.ams.dryDurationHours, null);
});
