import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("theme tokens follow the OS and stay on one cool charcoal system", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /@media \(prefers-color-scheme: light\)/);
  assert.match(css, /--page:\s*#101010/);
  assert.match(css, /--page:\s*#f4f4f5/);
  assert.match(css, /--ok:\s*#3ddc84/);
  assert.match(css, /--ok:\s*#157a45/);
  assert.equal(/data-theme/.test(css), false);
  assert.equal(/--admin-bg/.test(css), false);
  assert.equal(/art-gallery/.test(css), false);
  assert.equal(/print-rail/.test(css), false);
  assert.equal(/print-plate/.test(css), false);
  assert.equal(/gooey/.test(css), false);
});

test("chrome wordmark is Printcast and settings stay out of the header", async () => {
  const chrome = await readFile(new URL("../components/chrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /export const BRAND = "Printcast"/);
  assert.match(chrome, /href="\/prints"/);
  assert.match(chrome, /href="\/energy"/);
  assert.equal(/href="\/admin"/.test(chrome), false);
  assert.equal(/Bench printer/.test(chrome), false);
});
