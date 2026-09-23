export type HmsEntry = { message: string; wiki: string };
export type HmsMap = {
  source: string;
  codes: Record<string, HmsEntry>;
};

export type HmsItem = {
  code: string;
  message: string;
  wikiUrl: string;
  severity: "fatal" | "serious" | "common" | "info" | null;
};

const SEVERITY = ["", "fatal", "serious", "common", "info"] as const;

export function formatHmsCode(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const attr = Number(record.attr);
  const code = Number(record.code);
  if (!Number.isFinite(attr) || !Number.isFinite(code)) return null;
  if (attr === 0 && code === 0) return null;
  const hex = `${toHex(attr)}${toHex(code)}`.toUpperCase();
  return hex.match(/.{4}/g)?.join("-") ?? null;
}

export function visibleHms(value: unknown, map: HmsMap): HmsItem[] {
  if (!Array.isArray(value)) return [];
  const items: HmsItem[] = [];
  for (const entry of value) {
    const code = formatHmsCode(entry);
    if (!code) continue;
    const known = map.codes[code];
    if (!known) continue;
    items.push({
      code,
      message: known.message,
      wikiUrl: known.wiki,
      severity: severityOf(entry),
    });
  }
  return items;
}

function severityOf(item: unknown): HmsItem["severity"] {
  if (!item || typeof item !== "object") return null;
  const code = Number((item as Record<string, unknown>).code);
  if (!Number.isFinite(code)) return null;
  const level = (code >> 16) & 0xff;
  const label = SEVERITY[level];
  return label || null;
}

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}
