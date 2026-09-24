import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePrinterPath, shouldPublish, type PathConfig } from "./mediamtx.ts";

const savedConfig: PathConfig = { source: "rtsps://camera/live", sourceFingerprint: "abc", rtspTransport: "tcp" };

function fakeFetch(routes: Record<string, { status: number; body?: unknown }>) {
  const calls: { url: string; method: string; body: string | null; authorization: string | null }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? init.body : null,
      authorization: headers.get("authorization"),
    });
    const route = routes[`${method} ${url}`];
    if (!route) throw new Error(`unexpected ${method} ${url}`);
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), { status: route.status });
  };
  return { fetchImpl, calls };
}

test("the camera stays published while printing or when always-show is on", () => {
  assert.equal(shouldPublish("RUNNING", false), true);
  assert.equal(shouldPublish("PAUSE", false), true);
  assert.equal(shouldPublish("PREPARE", false), true);
  assert.equal(shouldPublish("FINISH", false), false);
  assert.equal(shouldPublish("IDLE", false), false);
  assert.equal(shouldPublish("IDLE", true), true);
});

test("an idle printer saves the path and then deletes it", async () => {
  const stored: PathConfig[] = [];
  const { fetchImpl, calls } = fakeFetch({
    "GET http://mtx:9997/v3/config/paths/get/printercam": { status: 200, body: savedConfig },
    "DELETE http://mtx:9997/v3/config/paths/delete/printercam": { status: 200 },
  });
  const result = await reconcilePrinterPath({
    apiUrl: "http://mtx:9997",
    pathName: "printercam",
    username: "api",
    password: "secret",
    publish: false,
    loadSaved: () => null,
    saveConfig: (config) => stored.push(config),
    fetchImpl,
  });
  assert.equal(result, "removed");
  assert.deepEqual(stored, [savedConfig]);
  assert.equal(calls[0]?.authorization, `Basic ${Buffer.from("api:secret").toString("base64")}`);
  assert.equal(calls[1]?.method, "DELETE");
});

test("a print puts the saved path back and an existing path is left alone", async () => {
  const { fetchImpl, calls } = fakeFetch({
    "GET http://mtx:9997/v3/config/paths/get/printercam": { status: 404 },
    "POST http://mtx:9997/v3/config/paths/add/printercam": { status: 200 },
  });
  const restored = await reconcilePrinterPath({
    apiUrl: "http://mtx:9997/",
    pathName: "printercam",
    username: "",
    password: "",
    publish: true,
    loadSaved: () => savedConfig,
    saveConfig: () => undefined,
    fetchImpl,
  });
  assert.equal(restored, "restored");
  assert.equal(calls[1]?.body, JSON.stringify(savedConfig));
  assert.equal(calls[0]?.authorization, null);

  const present = fakeFetch({
    "GET http://mtx:9997/v3/config/paths/get/printercam": { status: 200, body: savedConfig },
  });
  const unchanged = await reconcilePrinterPath({
    apiUrl: "http://mtx:9997",
    pathName: "printercam",
    username: "",
    password: "",
    publish: true,
    loadSaved: () => null,
    saveConfig: () => {
      throw new Error("should not save");
    },
    fetchImpl: present.fetchImpl,
  });
  assert.equal(unchanged, "present");
  assert.equal(present.calls.length, 1);
});

test("an empty API URL does nothing, and a missing saved config does not invent a path", async () => {
  const skipped = await reconcilePrinterPath({
    apiUrl: "  ",
    pathName: "printercam",
    username: "",
    password: "",
    publish: false,
    loadSaved: () => null,
    saveConfig: () => undefined,
    fetchImpl: async () => {
      throw new Error("network");
    },
  });
  assert.equal(skipped, "skipped");
  const { fetchImpl } = fakeFetch({
    "GET http://mtx:9997/v3/config/paths/get/printercam": { status: 404 },
  });
  const missing = await reconcilePrinterPath({
    apiUrl: "http://mtx:9997",
    pathName: "printercam",
    username: "",
    password: "",
    publish: true,
    loadSaved: () => null,
    saveConfig: () => undefined,
    fetchImpl,
  });
  assert.equal(missing, "no-saved-config");
});
