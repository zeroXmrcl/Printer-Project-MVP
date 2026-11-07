import assert from "node:assert/strict";
import test from "node:test";
import { cinemaHud, printing } from "./cinema-hud";

const base = {
  state: "IDLE",
  filename: null as string | null,
  percent: null as number | null,
  layer: null as number | null,
  totalLayers: null as number | null,
  stageLabel: null as string | null,
  remainingLabel: null as string | null,
  cameraVisible: false,
  streamUrl: null as string | null,
  chamberC: 32 as number | null,
};

test("printing() covers prepare, run, and pause", () => {
  assert.equal(printing("RUNNING"), true);
  assert.equal(printing("PREPARE"), true);
  assert.equal(printing("PAUSE"), true);
  assert.equal(printing("IDLE"), false);
  assert.equal(printing("FINISH"), false);
});

test("no stream uses the same cinematic idle language as a camera-off hero", () => {
  const hud = cinemaHud(base);
  assert.equal(hud.kind, "offline");
  assert.equal(hud.title, "Camera offline");
  assert.match(hud.meta, /Stream not set/);
  assert.equal(hud.showDials, false);
  assert.equal(hud.showBar, false);
});

test("a running print with no stream still shows progress on the offline hero", () => {
  const hud = cinemaHud({
    ...base,
    state: "RUNNING",
    filename: "bench-bracket.3mf",
    percent: 42,
    layer: 86,
    totalLayers: 240,
    remainingLabel: "1h 12m",
    cameraVisible: true,
  });
  assert.equal(hud.kind, "offline");
  assert.equal(hud.kicker, "Printing");
  assert.equal(hud.title, "bench-bracket.3mf");
  assert.equal(hud.showBar, true);
  assert.equal(hud.showDials, false);
  assert.match(hud.meta, /Stream not set/);
});

test("idle without a live camera stays a fullscreen idle hero, not a different layout", () => {
  const hud = cinemaHud({ ...base, streamUrl: "https://cam.example/index.m3u8" });
  assert.equal(hud.kind, "private");
  assert.equal(hud.title, "Printer idle");
  assert.match(hud.meta, /Camera hidden/);
  assert.equal(hud.showDials, false);
});

test("a running print shows progress, layer, and time left", () => {
  const hud = cinemaHud({
    ...base,
    state: "RUNNING",
    filename: "bench-bracket.3mf",
    percent: 42.4,
    layer: 86,
    totalLayers: 240,
    stageLabel: "Printing",
    remainingLabel: "1h 12m",
    cameraVisible: true,
    streamUrl: "https://cam.example/index.m3u8",
  });
  assert.equal(hud.kind, "printing");
  assert.equal(hud.kicker, "Printing");
  assert.equal(hud.title, "bench-bracket.3mf");
  assert.equal(hud.percent, 42);
  assert.equal(hud.showBar, true);
  assert.equal(hud.showDials, true);
  assert.match(hud.meta, /Layer 86 \/ 240/);
  assert.match(hud.meta, /about 1h 12m/);
});

test("idle with the camera allowed still uses the idle hero copy", () => {
  const hud = cinemaHud({
    ...base,
    cameraVisible: true,
    streamUrl: "https://cam.example/index.m3u8",
    chamberC: 36.2,
  });
  assert.equal(hud.kind, "idle");
  assert.equal(hud.title, "Printer idle");
  assert.match(hud.meta, /Chamber 36/);
  assert.equal(hud.showDials, false);
});
