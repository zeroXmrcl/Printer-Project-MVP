export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/pass|code|serial|secret|token|authorization/i.test(key)) continue;
    safe[key] = value;
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe }));
}

export function nextBackoff(currentMs: number): number {
  return Math.min(Math.max(1000, currentMs) * 2, 30_000);
}

export const STALE_MS = 15_000;
export const TELEMETRY_MS = 5_000;
export const SNAPSHOT_MS = 60_000;
