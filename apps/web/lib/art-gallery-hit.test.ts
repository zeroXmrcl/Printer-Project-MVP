import assert from "node:assert/strict";
import test from "node:test";
import { artGalleryIndex, galleryCenter, galleryLayout } from "./art-gallery-hit";

const cell = 0.75;

test("the print grid is two rows and reads sideways", () => {
  assert.deepEqual(galleryLayout(0), { cols: 1, rows: 1 });
  assert.deepEqual(galleryLayout(1), { cols: 1, rows: 1 });
  assert.deepEqual(galleryLayout(2), { cols: 2, rows: 1 });
  assert.deepEqual(galleryLayout(3), { cols: 2, rows: 2 });
  assert.deepEqual(galleryLayout(6), { cols: 3, rows: 2 });
});

test("a click lands on the photo under the pointer, left to right and top to bottom", () => {
  const size = { width: 200, height: 200 };
  const center = { x: 100, y: 100 };
  const grid = galleryLayout(5);
  assert.deepEqual(grid, { cols: 3, rows: 2 });

  const at = (col: number, rowFromTop: number) => {
    const cellY = grid.rows - 1 - rowFromTop;
    return { x: (col + 0.5) * cell, y: (cellY + 0.5) * cell };
  };

  assert.equal(artGalleryIndex(center, size, at(0, 0), 1, cell, 5, grid), 0);
  assert.equal(artGalleryIndex(center, size, at(1, 0), 1, cell, 5, grid), 1);
  assert.equal(artGalleryIndex(center, size, at(2, 0), 1, cell, 5, grid), 2);
  assert.equal(artGalleryIndex(center, size, at(0, 1), 1, cell, 5, grid), 3);
  assert.equal(artGalleryIndex(center, size, at(1, 1), 1, cell, 5, grid), 4);
  assert.equal(artGalleryIndex(center, size, at(2, 1), 1, cell, 5, grid), null);
});

test("the gutter between photos does not select a print", () => {
  const grid = galleryLayout(4);
  const cellY = grid.rows - 1;
  const gutter = { x: 0.05 * cell, y: (cellY + 0.05) * cell };
  assert.equal(artGalleryIndex({ x: 100, y: 100 }, { width: 200, height: 200 }, gutter, 1, cell, 4, grid), null);
});

test("barrel distortion still picks the photo at the screen edge", () => {
  const grid = { cols: 2, rows: 2 };
  const index = artGalleryIndex(
    { x: 200, y: 50 },
    { width: 200, height: 100 },
    { x: -0.715, y: 1.125 },
    1,
    cell,
    4,
    grid,
  );
  assert.equal(index, 1);
});

test("an empty gallery and a point outside the grid do not select", () => {
  const size = { width: 200, height: 200 };
  const center = { x: 100, y: 100 };
  const grid = galleryLayout(4);
  assert.equal(artGalleryIndex(center, size, galleryCenter(grid, cell), 1, cell, 0, grid), null);
  assert.equal(artGalleryIndex(center, size, { x: -1, y: -1 }, 1, cell, 4, grid), null);
});
