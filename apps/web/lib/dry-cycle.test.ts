import assert from "node:assert/strict";
import test from "node:test";
import { dryRemainingRatio, nextDryBaseline } from "./dry-cycle";

test("the first remaining time becomes the dry cycle length", () => {
  assert.equal(nextDryBaseline(null, 662, true), 662);
  assert.equal(nextDryBaseline(662, 661, true), 662);
  assert.equal(dryRemainingRatio(662, 331), 0.5);
});

test("a longer countdown starts a new cycle, and stopping clears it", () => {
  assert.equal(nextDryBaseline(100, 240, true), 240);
  assert.equal(nextDryBaseline(240, 0, false), null);
  assert.equal(dryRemainingRatio(null, 10), null);
});
