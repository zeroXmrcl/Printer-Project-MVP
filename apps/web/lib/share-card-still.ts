import fs from "node:fs";
import path from "node:path";
import { dataDir, database } from "./store";
import { pickShareCardStill, stillImageMime, type ShareCardStill } from "./share-card";

export type ResolvedShareCardStill = ShareCardStill & { filePath: string };

export function resolveShareCardStill(): ResolvedShareCardStill | null {
  const snapshot = latestSnapshotName();
  const photos = photoNames();
  const picked = pickShareCardStill({ snapshots: snapshot ? [snapshot] : [], photos });
  if (!picked) return null;
  const filePath = picked.kind === "snapshot" ? inside(path.join(dataDir(), "media"), picked.name) : inside(path.join(dataDir(), "photos"), picked.name);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return { ...picked, filePath };
}

function latestSnapshotName(): string | null {
  try {
    const row = database()
      .prepare(
        `SELECT rel_path FROM media
         WHERE kind = 'snapshot'
           AND (lower(rel_path) LIKE '%.jpg' OR lower(rel_path) LIKE '%.jpeg' OR lower(rel_path) LIKE '%.png')
         ORDER BY at DESC LIMIT 1`,
      )
      .get() as { rel_path: string } | undefined;
    return row?.rel_path ?? null;
  } catch {
    return null;
  }
}

function photoNames(): string[] {
  const dir = path.join(dataDir(), "photos");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => stillImageMime(name))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((item) => item.name);
}

function inside(root: string, name: string): string | null {
  if (!name || name.includes("\0")) return null;
  const base = path.resolve(root);
  const target = path.resolve(base, name);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) return null;
  return target;
}
