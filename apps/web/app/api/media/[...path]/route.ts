import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { safeMediaParts } from "../../../../lib/media-path";
import { snapshotThumbRelPath } from "../../../../lib/snapshot-thumb";
import { dataDir } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  if (!safeMediaParts(parts)) {
    return new Response("Not found", { status: 404 });
  }
  const root = path.resolve(dataDir(), "media");
  const rel = parts.join("/");
  const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const fullTarget = path.resolve(root, ...parts);
  if (fullTarget !== root && !fullTarget.startsWith(`${root}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  let target = fullTarget;
  if (wantThumb) {
    const thumbRel = snapshotThumbRelPath(rel);
    if (thumbRel) {
      const thumbPath = path.resolve(root, ...thumbRel.split("/"));
      if (
        (thumbPath === root || thumbPath.startsWith(`${root}${path.sep}`)) &&
        fs.existsSync(thumbPath) &&
        fs.statSync(thumbPath).isFile()
      ) {
        target = thumbPath;
      }
    }
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  const stream = Readable.toWeb(fs.createReadStream(target)) as ReadableStream;
  const cache = wantThumb && target !== fullTarget
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";
  return new Response(stream, {
    headers: { "Content-Type": type, "Cache-Control": cache },
  });
}
