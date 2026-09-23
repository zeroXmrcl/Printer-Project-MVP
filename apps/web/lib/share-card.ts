import path from "node:path";

export type ShareCardCopy = {
  title: string;
  subject: string;
  stats: string;
  description: string;
  host: string;
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
  const description = ["Live printer", subject, stats].filter(Boolean).join(" · ");
  return { title, subject, stats, description, host: input.host };
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
