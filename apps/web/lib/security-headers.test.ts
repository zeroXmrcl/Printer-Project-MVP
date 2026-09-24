import assert from "node:assert/strict";
import test from "node:test";
import { securityHeaders } from "./security-headers";

test("security headers stay off HSTS until the request is HTTPS", () => {
  const http = securityHeaders(false);
  assert.equal(http["X-Content-Type-Options"], "nosniff");
  assert.equal(http["X-Frame-Options"], "DENY");
  assert.equal("Strict-Transport-Security" in http, false);
  assert.match(http["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(securityHeaders(true)["Strict-Transport-Security"], "max-age=15552000");
});
