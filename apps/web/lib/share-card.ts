import path from "node:path";

export type ShareCardCopy = {
  title: string;
  subject: string;
  stats: string;
  description: string;
  host: string;
  state: string;
  linkTitle: string;
  linkDescription: string;
};

export type ShareCardStill = {
  kind: "snapshot" | "photo";
  name: string;
};

export function stillImageMime(name: string): "image/jpeg" | "image/png" | null {
  switch (path.extname(name).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return null;
  }
}

function headersFromInput(headers: Headers | Record<string, string | string[] | undefined | null>): Headers {
  if (typeof (headers as Headers).get === "function" && typeof (headers as Headers).forEach === "function") {
    return headers as Headers;
  }
  const out = new Headers();
  for (const [key, value] of Object.entries(headers as Record<string, string | string[] | undefined | null>)) {
    if (value == null || value === "") continue;
    out.set(key, Array.isArray(value) ? value[0] ?? "" : value);
  }
  return out;
}

function firstForwardedValue(raw: string | null): string | undefined {
  const first = raw?.split(",")[0]?.trim();
  return first ? first : undefined;
}

function isListenHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "0.0.0.0" || host === "::";
}

function pickPublicHost(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(`http://${value}`);
    if (isListenHostname(parsed.hostname)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function shareCardMetadataOrigin(
  headers: Headers | Record<string, string | string[] | undefined | null>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env.PRINTCAST_PUBLIC_URL ?? "").trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the request host.
    }
  }

  const list = headersFromInput(headers);
  const protoHeader = firstForwardedValue(list.get("x-forwarded-proto"))?.toLowerCase();
  const proto = protoHeader === "https" || protoHeader === "http" ? protoHeader : "http";
  const hostHeader = firstForwardedValue(list.get("host"));
  const forwardedHost = firstForwardedValue(list.get("x-forwarded-host"));
  const host = pickPublicHost(hostHeader) || pickPublicHost(forwardedHost) || hostHeader || forwardedHost || "127.0.0.1";
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return "http://127.0.0.1";
  }
}

const SHARE_CARD_STATUS: Record<string, { label: string; color: string }> = {
  RUNNING: { label: "Printing", color: "#3ddc84" },
  PAUSE: { label: "Paused", color: "#e6b35a" },
  FINISH: { label: "Finished", color: "#f4f4f5" },
  FAILED: { label: "Failed", color: "#e7a8a0" },
  IDLE: { label: "Idle", color: "#71717a" },
};

export function shareCardStatus(state: string | null | undefined): { label: string; color: string } {
  const key = state?.trim().toUpperCase() ?? "";
  return SHARE_CARD_STATUS[key] ?? SHARE_CARD_STATUS.IDLE;
}

export function shareCardMeter(state: string | null | undefined, percent: number | null): { show: boolean; percent: number } {
  const key = state?.trim().toUpperCase() ?? "";
  const value = percent !== null && Number.isFinite(percent) ? Math.round(Math.min(100, Math.max(0, percent))) : null;
  const show = value !== null && key !== "IDLE" && key !== "UNKNOWN" && key !== "";
  return { show, percent: show ? value : 0 };
}

export function shareCardTemp(value: number | null): string {
  return formatShareTemp(value) ?? "—";
}

export function shareCardBrand(title: string): string {
  const upper = title.trim().toUpperCase() || "PRINTCAST";
  if (upper.length <= 16) return upper;
  return `${upper.slice(0, 15)}…`;
}

export function formatShareTemp(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}°`;
}

export function buildShareCardCopy(input: {
  title?: string | null;
  file: string | null;
  percent: number | null;
  nozzleC: number | null;
  bedC: number | null;
  host: string;
  state?: string | null;
}): ShareCardCopy {
  const title = input.title?.trim() || "PrintCast";
  const base = path.basename(input.file?.trim() || "");
  const subject = base ? trimSubject(base) : "P2S";
  const parts: string[] = [];
  if (input.percent !== null && Number.isFinite(input.percent)) {
    parts.push(`${Math.round(input.percent)}%`);
  }
  const nozzle = formatShareTemp(input.nozzleC);
  const bed = formatShareTemp(input.bedC);
  if (nozzle) parts.push(nozzle);
  if (bed) parts.push(bed);
  const stats = parts.join(" · ");
  const statusLabel = shareCardStatus(input.state).label;
  const fileLabel = base ? trimSubject(base) : null;
  const linkTitle = fileLabel ?? statusLabel;
  const linkDescription = fileLabel ? statusLabel : title;
  const description = linkDescription;
  return { title, subject, stats, description, host: input.host, state: input.state?.trim().toUpperCase() || "IDLE", linkTitle, linkDescription };
}

export function pickShareCardStill(lists: { snapshots: string[]; photos: string[] }): ShareCardStill | null {
  const snapshot = lists.snapshots.find((name) => stillImageMime(name));
  if (snapshot) return { kind: "snapshot", name: snapshot };
  const photo = lists.photos.find((name) => stillImageMime(name));
  if (photo) return { kind: "photo", name: photo };
  return null;
}

export function shareCardOgImageId(still: ShareCardStill | null, mtimeMs: number): string {
  if (!still) return "none";
  const safeName = still.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${still.kind}-${safeName}-${Math.trunc(mtimeMs)}`;
}

export function fallbackShareCardCopy(host = ""): ShareCardCopy {
  return buildShareCardCopy({ file: null, percent: null, nozzleC: null, bedC: null, host });
}

function trimSubject(name: string): string {
  if (name.length <= 42) return name;
  return `${name.slice(0, 41)}…`;
}
