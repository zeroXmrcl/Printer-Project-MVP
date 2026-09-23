import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildShareCardCopy,
  fallbackShareCardCopy,
  pickShareCardStill,
  shareCardMetadataOrigin,
  shareCardOgImageId,
  stillImageMime,
} from "./share-card";

test("share card copy uses the file, progress, and both temperatures", () => {
  const copy = buildShareCardCopy({
    file: "/data/Metadata/bench-bracket.3mf",
    percent: 42.2,
    nozzleC: 238,
    bedC: 80.4,
    host: "print.0xmarcel.com",
  });
  assert.equal(copy.title, "PrintCast");
  assert.equal(copy.subject, "bench-bracket.3mf");
  assert.equal(copy.stats, "42% · 238° · 80.4°");
  assert.equal(copy.description, "Live printer · bench-bracket.3mf · 42% · 238° · 80.4°");
  assert.equal(copy.host, "print.0xmarcel.com");
});

test("share card copy falls back to P2S and omits missing numbers", () => {
  const copy = buildShareCardCopy({ file: "  ", percent: null, nozzleC: null, bedC: 18, host: "localhost" });
  assert.equal(copy.subject, "P2S");
  assert.equal(copy.stats, "18°");
  assert.equal(copy.description, "Live printer · P2S · 18°");
  assert.equal(fallbackShareCardCopy("").title, "PrintCast");
});

test("share card still prefers the newest snapshot, then a printer photo", () => {
  assert.deepEqual(
    pickShareCardStill({ snapshots: ["job/200.jpg", "job/100.jpg"], photos: ["front.png"] }),
    { kind: "snapshot", name: "job/200.jpg" },
  );
  assert.deepEqual(pickShareCardStill({ snapshots: ["notes.txt"], photos: ["front.png", "older.jpg"] }), {
    kind: "photo",
    name: "front.png",
  });
  assert.equal(pickShareCardStill({ snapshots: [], photos: ["shot.webp"] }), null);
});

test("share card origin prefers the public URL, then the tunnel host", () => {
  assert.equal(
    shareCardMetadataOrigin({ host: "127.0.0.1:3010" }, { ...process.env, PRINTCAST_PUBLIC_URL: "https://print.0xmarcel.com" }),
    "https://print.0xmarcel.com",
  );
  assert.equal(
    shareCardMetadataOrigin({ host: "tunnel.example", "x-forwarded-host": "0.0.0.0:3000", "x-forwarded-proto": "https" }),
    "https://tunnel.example",
  );
  assert.equal(
    shareCardMetadataOrigin({ host: "tunnel.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" }),
    "https://tunnel.example",
  );
});

test("share card image id changes with the still and stays url-safe", () => {
  const first = shareCardOgImageId({ kind: "snapshot", name: "job/100.jpg" }, 10);
  assert.equal(first, "snapshot-job_100.jpg-10");
  assert.notEqual(first, shareCardOgImageId({ kind: "snapshot", name: "job/101.jpg" }, 10));
  assert.equal(shareCardOgImageId(null, 0), "none");
  assert.equal(/[^a-zA-Z0-9._-]/.test(first), false);
});

test("still mime accepts jpeg and png only", () => {
  assert.equal(stillImageMime("shot.jpg"), "image/jpeg");
  assert.equal(stillImageMime("shot.PNG"), "image/png");
  assert.equal(stillImageMime("shot.webp"), null);
});

test("opengraph image does not export generateImageMetadata", async () => {
  const src = await readFile(new URL("../app/opengraph-image.tsx", import.meta.url), "utf8");
  assert.equal(/export async function generateImageMetadata/.test(src), false);
  assert.match(src, /export default async function Image/);
  const image = await readFile(new URL("./share-card-image.ts", import.meta.url), "utf8");
  assert.equal(/import\(["']sharp["']\)/.test(image), false);
  assert.match(image, /image\/svg\+xml/);
});
