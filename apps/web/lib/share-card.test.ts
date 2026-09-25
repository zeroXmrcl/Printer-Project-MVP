import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildShareCardCopy,
  fallbackShareCardCopy,
  pickShareCardStill,
  shareCardMetadataOrigin,
  shareCardBrand,
  shareCardMeter,
  shareCardOgImageId,
  shareCardStatus,
  shareCardTemp,
  stillImageMime,
} from "./share-card";

test("share card copy uses the file, progress, and both temperatures", () => {
  const copy = buildShareCardCopy({
    file: "/data/Metadata/bench-bracket.3mf",
    percent: 42.2,
    nozzleC: 238,
    bedC: 80.4,
    host: "print.0xmarcel.com",
    state: "RUNNING",
  });
  assert.equal(copy.title, "PrintCast");
  assert.equal(copy.subject, "bench-bracket.3mf");
  assert.equal(copy.stats, "42% · 238° · 80.4°");
  assert.equal(copy.linkTitle, "bench-bracket.3mf");
  assert.equal(copy.linkDescription, "Printing");
  assert.equal(copy.host, "print.0xmarcel.com");
});

test("share card copy falls back to P2S and omits missing numbers", () => {
  const copy = buildShareCardCopy({ file: "  ", percent: null, nozzleC: null, bedC: 18, host: "localhost" });
  assert.equal(copy.subject, "P2S");
  assert.equal(copy.stats, "18°");
  assert.equal(copy.linkTitle, "Idle");
  assert.equal(copy.linkDescription, "PrintCast");
  assert.equal(fallbackShareCardCopy("").title, "PrintCast");
});

test("share card status colors only the known printer states", () => {
  assert.deepEqual(shareCardStatus("RUNNING"), { label: "Printing", color: "#3ddc84" });
  assert.deepEqual(shareCardStatus("pause"), { label: "Paused", color: "#e6b35a" });
  assert.deepEqual(shareCardStatus("FINISH"), { label: "Finished", color: "#f4f4f5" });
  assert.deepEqual(shareCardStatus("FAILED"), { label: "Failed", color: "#e7a8a0" });
  assert.deepEqual(shareCardStatus("IDLE"), { label: "Idle", color: "#71717a" });
  assert.deepEqual(shareCardStatus("UNKNOWN"), { label: "Idle", color: "#71717a" });
  assert.deepEqual(shareCardStatus(null), { label: "Idle", color: "#71717a" });
});

test("share card meter hides the bar when the printer is idle or has no percent", () => {
  assert.deepEqual(shareCardMeter("RUNNING", 42.2), { show: true, percent: 42 });
  assert.deepEqual(shareCardMeter("FINISH", 100), { show: true, percent: 100 });
  assert.deepEqual(shareCardMeter("PAUSE", 0), { show: true, percent: 0 });
  assert.deepEqual(shareCardMeter("IDLE", 100), { show: false, percent: 0 });
  assert.deepEqual(shareCardMeter("UNKNOWN", 10), { show: false, percent: 0 });
  assert.deepEqual(shareCardMeter("RUNNING", null), { show: false, percent: 0 });
  assert.equal(shareCardTemp(238), "238°");
  assert.equal(shareCardTemp(null), "—");
  assert.equal(shareCardBrand("PrintCast"), "PRINTCAST");
  assert.equal(shareCardBrand("A very long display title"), "A VERY LONG DIS…");
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
  assert.match(src, /export const revalidate = 0/);
  assert.match(src, /Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0"/);
  assert.match(src, /CDN-Cache-Control": "no-store"/);
  assert.match(src, /Cloudflare-CDN-Cache-Control": "no-store"/);
  const image = await readFile(new URL("./share-card-image.ts", import.meta.url), "utf8");
  assert.equal(/import\(["']sharp["']\)/.test(image), false);
  assert.match(image, /image\/svg\+xml/);
});
