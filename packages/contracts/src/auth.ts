import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_MS = 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const key = scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export function signSession(username: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: username, exp: now + SESSION_MS })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): { u: string } | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as { u?: unknown; exp?: unknown };
    if (typeof parsed.u !== "string" || typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return { u: parsed.u };
  } catch {
    return null;
  }
}

const failures = new Map<string, number[]>();

export function loginAllowed(ip: string, now = Date.now()): boolean {
  const recent = (failures.get(ip) ?? []).filter((at) => now - at < 15 * 60 * 1000);
  failures.set(ip, recent);
  return recent.length < 5;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const recent = failures.get(ip) ?? [];
  recent.push(now);
  failures.set(ip, recent);
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export function safeStreamUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
