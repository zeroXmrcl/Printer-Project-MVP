import assert from "node:assert/strict";
import test from "node:test";
import { mediaRequestAllowed, snapshotSourceFromThumb } from "./public-still";

const finals = new Set(["job/final.jpg"]);

test("snapshot thumbs map back to the source still", () => {
  assert.equal(snapshotSourceFromThumb("job/thumbs/final.jpg"), "job/final.jpg");
  assert.equal(snapshotSourceFromThumb("a/b/thumbs/shot.webp"), "a/b/shot.webp");
  assert.equal(snapshotSourceFromThumb("job/final.jpg"), null);
  assert.equal(snapshotSourceFromThumb("job/thumbs/mid.jpg/nope"), null);
  assert.equal(snapshotSourceFromThumb("../thumbs/x.jpg"), null);
  assert.equal(snapshotSourceFromThumb("job/thumbs/clip.mp4"), null);
});

test("only a closed job's last snapshot and its thumb are public", () => {
  assert.equal(mediaRequestAllowed("job/final.jpg", "snapshot", finals), true);
  assert.equal(mediaRequestAllowed("job/mid.jpg", "snapshot", finals), false);
  assert.equal(mediaRequestAllowed("job/open.jpg", "snapshot", finals), false);
  assert.equal(mediaRequestAllowed("job/lap.mp4", "timelapse", finals), true);
  assert.equal(mediaRequestAllowed("job/thumbs/final.jpg", null, finals), true);
  assert.equal(mediaRequestAllowed("job/thumbs/mid.jpg", null, finals), false);
  assert.equal(mediaRequestAllowed("job/stray.jpg", null, finals), false);
});
