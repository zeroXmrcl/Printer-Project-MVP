import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { safePhotoName } from "../../../../lib/media-path";
import { dataDir } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!safePhotoName(name)) return new Response("Not found", { status: 404 });
  const root = path.resolve(dataDir(), "photos");
  const target = path.resolve(root, name);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return new Response("Not found", { status: 404 });
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  const stream = Readable.toWeb(fs.createReadStream(target)) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" } });
}
