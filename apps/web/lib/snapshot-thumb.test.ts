import assert from "node:assert/strict";
import test from "node:test";
import { snapshotThumbRelPath, snapshotThumbSrc } from "./snapshot-thumb";

test("snapshot thumb src appends thumb=1 without changing the path", () => {
  assert.equal(snapshotThumbSrc("/api/media/job/100.jpg"), "/api/media/job/100.jpg?thumb=1");
  assert.equal(snapshotThumbSrc("/api/media/job/100.jpg?x=1"), "/api/media/job/100.jpg?x=1&thumb=1");
  assert.equal(snapshotThumbSrc("/api/media/job/100.jpg#frame"), "/api/media/job/100.jpg?thumb=1#frame");
});

test("snapshot thumb rel path nests under thumbs/", () => {
  assert.equal(snapshotThumbRelPath("job_demo/1710000000.jpg"), "job_demo/thumbs/1710000000.jpg");
  assert.equal(snapshotThumbRelPath("a/b/c.png"), "a/b/thumbs/c.png");
  assert.equal(snapshotThumbRelPath("solo.jpg"), null);
  assert.equal(snapshotThumbRelPath("job/thumbs/1.jpg"), null);
  assert.equal(snapshotThumbRelPath("../x.jpg"), null);
});
