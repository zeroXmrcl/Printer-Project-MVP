/** Same cell pick as the Art Gallery fragment shader, including barrel distortion. */
export function artGalleryIndex(
  pointer: { x: number; y: number },
  size: { width: number; height: number },
  offset: { x: number; y: number },
  zoom: number,
  cellSize: number,
  count: number,
): number | null {
  if (count <= 0 || size.width <= 0 || size.height <= 0 || cellSize === 0) return null;
  const screenX = (pointer.x / size.width) * 2 - 1;
  const screenY = -((pointer.y / size.height) * 2 - 1);
  const radius = Math.hypot(screenX, screenY);
  const distortion = 1 - 0.08 * radius * radius;
  const aspect = size.width / size.height;
  const worldX = screenX * distortion * aspect * zoom + offset.x;
  const worldY = screenY * distortion * zoom + offset.y;
  const cellX = Math.floor(worldX / cellSize);
  const cellY = Math.floor(worldY / cellSize);
  const raw = cellX + cellY * 3;
  return raw - count * Math.floor(raw / count);
}
