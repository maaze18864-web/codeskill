import test from "node:test";
import assert from "node:assert/strict";
import {
  dockerRunArgs,
  localPreviewPort,
  previewFrameAncestors,
  relativePath,
  requestHeaders,
} from "./runner.mjs";
test("sandboxes have no network, host mounts, credentials, ports, or privileges", () => {
  const args = dockerRunArgs("test", "image:tag");
  for (const value of [
    "none",
    "1000:1000",
    "--read-only",
    "ALL",
    "no-new-privileges=true",
    "--memory",
    "--pids-limit",
  ])
    assert.ok(args.includes(value));
  for (const option of [
    "--privileged",
    "--volume",
    "-v",
    "--publish",
    "-p",
    "--env",
    "-e",
    "--pid=host",
    "--network=host",
  ])
    assert.ok(!args.includes(option));
  assert.equal(args.filter((a) => a === "--tmpfs").length, 2);
});
test("API requests cannot select a destination host or inject a second request", () => {
  for (const p of [
    "https://internal",
    "//169.254.169.254/",
    "/a\r\nHost: internal",
    "/a\\b",
  ])
    assert.equal(relativePath(p), false);
  assert.equal(relativePath("/api/hello?name=student"), true);
});
test("hop-by-hop headers and platform cookies cannot reach a project", () => {
  assert.deepEqual(
    requestHeaders(
      '{"Host":"internal","Cookie":"session=secret","Connection":"upgrade","X-Forwarded-For":"x","Authorization":"Bearer custom","Content-Type":"application/json"}',
    ),
    { authorization: "Bearer custom", "content-type": "application/json" },
  );
  assert.throws(() => requestHeaders("{bad"));
  assert.throws(() => requestHeaders('{"a":"b\\r\\nc"}'));
  assert.throws(() => requestHeaders("[]"));
});
test("local preview ports stay unique per runtime and inside the valid range", () => {
  assert.equal(localPreviewPort(5081, [5081, 5082]), 5083);
  assert.equal(localPreviewPort(5081, []), 5081);
  assert.throws(() => localPreviewPort(70000));
  assert.throws(() => localPreviewPort(5081, [5081], 5081));
});
test("local preview frames accept both application loopback aliases on the configured port", () => {
  assert.equal(
    previewFrameAncestors("http://127.0.0.1:3000", true),
    "http://127.0.0.1:3000 http://localhost:3000",
  );
  assert.equal(
    previewFrameAncestors("http://localhost:3002", true),
    "http://localhost:3002 http://127.0.0.1:3002",
  );
});
test("production and nonlocal frame policies retain the single configured origin", () => {
  assert.equal(
    previewFrameAncestors("https://codeskill.novaserve.cloud"),
    "https://codeskill.novaserve.cloud",
  );
  assert.equal(
    previewFrameAncestors("http://codeskill.example:3000", true),
    "http://codeskill.example:3000",
  );
  assert.equal(
    previewFrameAncestors("https://localhost:3000", true),
    "https://localhost:3000",
  );
});
