import assert from "node:assert/strict";
import test from "node:test";
import { safeMediaParts, safePhotoName } from "./media-path";

test("media paths reject traversal and photo names stay to a single safe file", () => {
  assert.equal(safeMediaParts(["job", "frame.jpg"]), true);
  assert.equal(safeMediaParts(["..", "secret"]), false);
  assert.equal(safeMediaParts(["a/b.jpg"]), false);
  assert.equal(safePhotoName("front.jpg"), true);
  assert.equal(safePhotoName("../front.jpg"), false);
  assert.equal(safePhotoName("a\\b.png"), false);
});
