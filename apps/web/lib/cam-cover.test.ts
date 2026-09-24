import assert from "node:assert/strict";
import test from "node:test";
import { coverShouldHide, noteLiveEdge, playbackIsLive } from "./cam-cover";

test("a repeated playlist edge does not count as a running stream", () => {
  const first = noteLiveEdge(null, 40, 1_000);
  const again = noteLiveEdge(first, 40.02, 9_000);
  assert.equal(again, first);
  assert.equal(
    playbackIsLive({
      playing: true,
      currentTime: 38,
      edge: again?.edge ?? null,
      edgeAtMs: again?.atMs ?? null,
      stuckEdge: 40,
      nowMs: 9_000,
    }),
    false,
  );
});

test("the cover stays up until a newer edge is actually playing", () => {
  const stale = noteLiveEdge(null, 40, 1_000);
  const advanced = noteLiveEdge(stale, 44, 10_000);
  assert.notEqual(advanced, stale);
  assert.equal(
    coverShouldHide({ fatal: false, playing: true, live: false, shownAtMs: 0, nowMs: 10_000 }),
    false,
  );
  assert.equal(
    playbackIsLive({
      playing: true,
      currentTime: 41,
      edge: advanced?.edge ?? null,
      edgeAtMs: advanced?.atMs ?? null,
      stuckEdge: null,
      nowMs: 10_000,
    }),
    true,
  );
  assert.equal(
    coverShouldHide({ fatal: false, playing: true, live: true, shownAtMs: 10_000, nowMs: 12_000 }),
    false,
  );
  assert.equal(
    coverShouldHide({ fatal: false, playing: true, live: true, shownAtMs: 10_000, nowMs: 13_000 }),
    true,
  );
});
