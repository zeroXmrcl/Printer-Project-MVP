import assert from "node:assert/strict";
import test from "node:test";
import { chooseTimelapse } from "./files";

test("timelapse picker skips files older than the job", () => {
  const chosen = chooseTimelapse(
    [
      { name: "old.mp4", modifiedAt: 1_000 },
      { name: "new.mp4", modifiedAt: 10_000 },
      { name: "note.txt", modifiedAt: 11_000 },
    ],
    9_000,
  );
  assert.equal(chosen?.name, "new.mp4");
});
