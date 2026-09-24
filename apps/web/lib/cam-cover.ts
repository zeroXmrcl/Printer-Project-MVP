export const COVER_MIN_MS = 3000;
export const COVER_FADE_MS = 400;
/** Drop the cover only if the playlist edge moved this recently. */
export const LIVE_FRESH_MS = 8000;
/** Playhead farther behind than this is leftover buffer, not the live edge. */
export const LIVE_EDGE_SLACK_S = 12;

export type LiveEdge = { edge: number; atMs: number };

/** GrowCast `coverShouldHide` — keep the loading banner until the stream is live for COVER_MIN_MS. */
export function coverShouldHide(input: {
  fatal: boolean;
  playing: boolean;
  live: boolean;
  shownAtMs: number | null;
  nowMs: number;
}): boolean {
  if (input.fatal || !input.live || !input.playing) {
    return false;
  }
  if (input.shownAtMs === null) {
    return true;
  }
  return input.nowMs - input.shownAtMs >= COVER_MIN_MS;
}

/** Same playlist poll must not look like a new live edge. A real move refreshes the clock. */
export function noteLiveEdge(prev: LiveEdge | null, edge: number, nowMs: number): LiveEdge | null {
  if (!Number.isFinite(edge)) return prev;
  if (prev && Math.abs(edge - prev.edge) <= 0.05) return prev;
  return { edge, atMs: nowMs };
}

/** True only when playback is near an edge that is still advancing past any stuck mark. */
export function playbackIsLive(input: {
  playing: boolean;
  currentTime: number;
  edge: number | null;
  edgeAtMs: number | null;
  stuckEdge: number | null;
  nowMs: number;
}): boolean {
  if (!input.playing || input.edge === null || input.edgeAtMs === null) return false;
  if (input.nowMs - input.edgeAtMs > LIVE_FRESH_MS) return false;
  if (input.stuckEdge !== null && input.edge <= input.stuckEdge + 0.05) return false;
  return input.edge - input.currentTime <= LIVE_EDGE_SLACK_S;
}
