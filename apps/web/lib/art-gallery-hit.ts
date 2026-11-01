/** Share of a cell occupied by the photo. The shader uses the same span. */
export const GALLERY_IMAGE_SPAN = 0.6;

/** Two rows fit the stage. Extra prints extend sideways, so a vertical swipe can still scroll the page. */
export function galleryLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  return { cols: Math.ceil(count / 2), rows: 2 };
}

/** World point that sits at the screen center when the grid is centered. */
export function galleryCenter(grid: { cols: number; rows: number }, cellSize: number): { x: number; y: number } {
  return { x: (grid.cols * cellSize) / 2, y: (grid.rows * cellSize) / 2 };
}

/** Same cell pick as the gallery shader, including barrel distortion.
 *  Null when the pointer misses a photo, so the gutter and caption do not select a neighbor.
 */
export function artGalleryIndex(
  pointer: { x: number; y: number },
  size: { width: number; height: number },
  offset: { x: number; y: number },
  zoom: number,
  cellSize: number,
  count: number,
  grid: { cols: number; rows: number },
): number | null {
  if (count <= 0 || grid.cols <= 0 || grid.rows <= 0 || size.width <= 0 || size.height <= 0 || cellSize === 0) return null;
  const screenX = (pointer.x / size.width) * 2 - 1;
  const screenY = -((pointer.y / size.height) * 2 - 1);
  const radius = Math.hypot(screenX, screenY);
  const distortion = 1 - 0.08 * radius * radius;
  const aspect = size.width / size.height;
  const worldX = screenX * distortion * aspect * zoom + offset.x;
  const worldY = screenY * distortion * zoom + offset.y;
  const cellX = Math.floor(worldX / cellSize);
  const cellY = Math.floor(worldY / cellSize);
  const col = cellX;
  const row = grid.rows - 1 - cellY;
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  const index = col + row * grid.cols;
  if (index >= count) return null;
  const border = (1 - GALLERY_IMAGE_SPAN) / 2;
  const imageUVx = (worldX / cellSize - cellX - border) / GALLERY_IMAGE_SPAN;
  const imageUVy = (worldY / cellSize - cellY - border) / GALLERY_IMAGE_SPAN;
  if (imageUVx < 0 || imageUVx > 1 || imageUVy < 0 || imageUVy > 1) return null;
  return index;
}
