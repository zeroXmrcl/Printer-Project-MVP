export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function isPlainObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeFields(
  base: Record<string, Json>,
  patch: Record<string, Json>,
): Record<string, Json> {
  const next: Record<string, Json> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const previous = next[key];
    if (isPlainObject(value) && isPlainObject(previous)) {
      next[key] = mergeFields(previous, value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function readPrint(message: unknown): Record<string, Json> | null {
  if (!isPlainObject(message)) return null;
  const print = message.print;
  if (!isPlainObject(print)) return null;
  return print;
}

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function firstPresent(source: Record<string, Json>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return undefined;
}
