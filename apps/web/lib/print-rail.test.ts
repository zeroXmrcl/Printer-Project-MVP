import assert from "node:assert/strict";
import test from "node:test";
import { railLoopCopies, railOverflows } from "./print-rail";

test("rail overflows only when content is taller than the viewport", () => {
  assert.equal(railOverflows(200, 200), false);
  assert.equal(railOverflows(201, 200), false);
  assert.equal(railOverflows(202, 200), true);
  assert.equal(railOverflows(0, 0), false);
});

test("rail loop copies duplicate the list once for seamless wrap", () => {
  assert.deepEqual(railLoopCopies([]), []);
  assert.deepEqual(railLoopCopies(["a"]), ["a", "a"]);
  assert.deepEqual(railLoopCopies(["a", "b"]), ["a", "b", "a", "b"]);
});
