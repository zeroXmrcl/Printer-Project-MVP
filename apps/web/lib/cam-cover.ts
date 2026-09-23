export const COVER_MIN_MS = 3000;
export const COVER_FADE_MS = 400;

/** GrowCast `coverShouldHide` — keep the loading banner until playing for COVER_MIN_MS. */
export function coverShouldHide(input: {
  fatal: boolean;
  playing: boolean;
  shownAtMs: number | null;
  nowMs: number;
}): boolean {
  if (input.fatal) {
    return false;
  }
  if (input.shownAtMs === null) {
    return true;
  }
  if (!input.playing) {
    return false;
  }
  return input.nowMs - input.shownAtMs >= COVER_MIN_MS;
}
