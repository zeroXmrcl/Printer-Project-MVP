/** The printer only reports minutes left. Prefer a known programmed length; otherwise the first countdown we see is the cycle length. */
export function nextDryBaseline(
  previous: number | null,
  remaining: number | null,
  drying: boolean,
  programmedMin: number | null = null,
): number | null {
  if (!drying || remaining === null || remaining <= 0) return null;
  if (programmedMin !== null && programmedMin > 0) return Math.max(programmedMin, remaining);
  if (previous === null || remaining > previous) return remaining;
  return previous;
}

/** Share of the remembered cycle that is still left, from 0 to 1. */
export function dryRemainingRatio(baseline: number | null, remaining: number | null): number | null {
  if (baseline === null || remaining === null || baseline <= 0) return null;
  return Math.min(1, Math.max(0, remaining / baseline));
}
