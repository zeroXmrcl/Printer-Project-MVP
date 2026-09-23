import { readFile } from "node:fs/promises";
import path from "node:path";
import { stillImageMime, type ShareCardStill } from "./share-card";

function asDataUrl(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function rasterizeShareCardAssets(still: (ShareCardStill & { filePath: string }) | null): Promise<{
  stillSrc: string | null;
  logoSrc: string;
}> {
  const logoSvg = await readFile(path.join(process.cwd(), "public", "mark.svg"));
  const logoSrc = asDataUrl("image/svg+xml", logoSvg);
  if (!still) return { stillSrc: null, logoSrc };
  const mime = stillImageMime(still.name);
  if (!mime) return { stillSrc: null, logoSrc };
  try {
    const bytes = await readFile(still.filePath);
    return { stillSrc: asDataUrl(mime, bytes), logoSrc };
  } catch {
    return { stillSrc: null, logoSrc };
  }
}
