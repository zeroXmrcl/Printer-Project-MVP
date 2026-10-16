/** `job/thumbs/file.jpg` → `job/file.jpg`. Anything else is not a snapshot thumb. */
export function snapshotSourceFromThumb(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 3 || parts[parts.length - 2] !== "thumbs") return null;
  if (parts.slice(0, -2).includes("thumbs")) return null;
  const file = parts[parts.length - 1];
  if (!file || !/\.(jpe?g|png|webp)$/i.test(file)) return null;
  return [...parts.slice(0, -2), file].join("/");
}

/**
 * Public media is a timelapse (or any non-snapshot kind), the last snapshot of a
 * closed job, or the thumb of that still. Intermediate snapshots stay private.
 */
export function mediaRequestAllowed(relPath: string, kind: string | null, finals: ReadonlySet<string>): boolean {
  if (kind === "snapshot") return finals.has(relPath);
  if (kind !== null) return true;
  const source = snapshotSourceFromThumb(relPath);
  return source !== null && finals.has(source);
}
