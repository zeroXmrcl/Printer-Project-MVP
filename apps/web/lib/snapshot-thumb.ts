/** Longest edge for home-gallery stills (GrowCast-aligned). */
export const SNAPSHOT_THUMB_EDGE = 640;

/**
 * Grid/plate URL. Keeps the original snapshot path; the media route serves the
 * sibling thumbs file when `thumb=1` is set.
 */
export function snapshotThumbSrc(url: string): string {
  const hashAt = url.indexOf("#");
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}thumb=1${hash}`;
}

/** `jobId/123.jpg` → `jobId/thumbs/123.jpg` (same basename under a thumbs/ sibling). */
export function snapshotThumbRelPath(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.includes("thumbs")) return null;
  const file = parts[parts.length - 1];
  if (!file || !/\.(jpe?g|png|webp)$/i.test(file)) return null;
  const dir = parts.slice(0, -1);
  return [...dir, "thumbs", file].join("/");
}
