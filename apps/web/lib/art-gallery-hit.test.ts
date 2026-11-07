import assert from "node:assert/strict";
import test from "node:test";
import { artGalleryIndex } from "./art-gallery-hit";

test("the gallery hit test follows the shader cell index", () => {
  const size = { width: 200, height: 200 };
  const center = { x: 100, y: 100 };
  assert.equal(artGalleryIndex(center, size, { x: 0, y: 0 }, 1, 0.75, 4), 0);
  assert.equal(artGalleryIndex(center, size, { x: 0.8, y: 0 }, 1, 0.75, 4), 1);
  assert.equal(artGalleryIndex(center, size, { x: -0.1, y: 0 }, 1, 0.75, 4), 3);
  assert.equal(artGalleryIndex({ x: 200, y: 50 }, { width: 200, height: 100 }, { x: 0, y: 0 }, 1, 0.75, 8), 2);
  assert.equal(artGalleryIndex(center, size, { x: 0, y: 0 }, 1, 0.75, 0), null);
});
