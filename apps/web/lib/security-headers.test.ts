import assert from "node:assert/strict";
import test from "node:test";
import { securityHeaders, streamOrigin } from "./security-headers";

test("security headers stay off HSTS until the request is HTTPS", () => {
  const http = securityHeaders(false);
  assert.equal(http["X-Content-Type-Options"], "nosniff");
  assert.equal(http["X-Frame-Options"], "DENY");
  assert.equal("Strict-Transport-Security" in http, false);
  assert.match(http["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(securityHeaders(true)["Strict-Transport-Security"], "max-age=15552000");
});

function directive(policy: string, name: string): string {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `));
  assert.ok(found);
  return found;
}

test("stream policy allows only the configured origin", () => {
  const policy = securityHeaders(true, "https://stream.example/printercam/index.m3u8")["Content-Security-Policy"];
  assert.equal(directive(policy, "connect-src"), "connect-src 'self' https://stream.example");
  assert.equal(directive(policy, "media-src"), "media-src 'self' blob: https://stream.example");
  assert.equal(directive(policy, "script-src"), "script-src 'self' 'unsafe-inline'");
});

test("a missing stream URL does not open every origin", () => {
  const policy = securityHeaders(false, "  ")["Content-Security-Policy"];
  assert.equal(directive(policy, "connect-src"), "connect-src 'self'");
  assert.equal(directive(policy, "media-src"), "media-src 'self' blob:");
  assert.equal(streamOrigin("notaurl"), null);
  assert.equal(streamOrigin("ftp://files.example/cam"), null);
  assert.equal(streamOrigin("http://192.168.1.8:8888/live/index.m3u8"), "http://192.168.1.8:8888");
});
