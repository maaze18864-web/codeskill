import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  instrumentPreviewHtml,
  previewConsoleScript,
} from "./preview-console.mjs";

test("console capture is inserted before app scripts for plain and compressed HTML", () => {
  const html =
    '<!doctype html><html><head><script type="module" src="app.js"></script></head></html>';
  for (const compressed of [false, true]) {
    const response = {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: (compressed ? gzipSync(html) : Buffer.from(html)).toString(
        "base64",
      ),
      bridgeEncoding: compressed ? "gzip" : undefined,
    };
    const result = instrumentPreviewHtml(
      response,
      "/p/test/__codeskill_console.js",
    );
    const raw = Buffer.from(result.body, "base64");
    const output = (compressed ? gunzipSync(raw) : raw).toString();
    assert.match(
      output,
      /<head><script src="\/p\/test\/__codeskill_console.js"><\/script><script type="module"/,
    );
    assert.equal(result.bridgeEncoding, response.bridgeEncoding);
    assert.equal(Buffer.from(response.body, "base64").equals(raw), false);
  }
});

test("JSON, errors, and non-HTML assets are never modified", () => {
  for (const [status, type] of [
    [200, "application/json"],
    [200, "application/javascript"],
    [500, "text/html"],
  ]) {
    const response = {
      status,
      headers: { "content-type": type },
      body: Buffer.from("original").toString("base64"),
    };
    assert.equal(instrumentPreviewHtml(response, "/console.js"), response);
  }
});

function browser() {
  const messages = [],
    original = [],
    handlers = {};
  const console = Object.fromEntries(
    ["log", "warn", "error", "info", "debug", "clear"].map((level) => [
      level,
      (...args) => original.push({ level, args }),
    ]),
  );
  const context = {
    console,
    Response,
    Error,
    Date,
    window: {
      parent: {
        postMessage: (data, origin) => messages.push({ data, origin }),
      },
      addEventListener: (type, handler) => {
        handlers[type] = handler;
      },
    },
  };
  vm.runInNewContext(
    previewConsoleScript(["https://codeskill.example"]),
    context,
  );
  return { ...context, messages, original, handlers };
}

test("browser console preserves native logs and safely formats objects, responses and errors", () => {
  const b = browser();
  const circular = { value: "student data" };
  circular.self = circular;
  b.console.log(
    "Loaded",
    circular,
    new Response('{"ok":true}', { status: 201 }),
  );
  const { data, origin } = b.messages[0];
  assert.equal(origin, "https://codeskill.example");
  assert.equal(data.channel, "codeskill:project-console");
  assert.equal(data.level, "log");
  assert.match(data.args[1], /Circular/);
  assert.match(data.args[2], /"status": 201/);
  assert.equal(b.original[0].args[1], circular);
  b.handlers.error({
    error: new Error("Broken render"),
    filename: "app.jsx",
    lineno: 12,
    colno: 3,
  });
  assert.match(
    b.messages.at(-1).data.args.join(" "),
    /Broken render.*\s.*app.jsx:12:3/s,
  );
  b.handlers.unhandledrejection({ reason: "API failed" });
  assert.match(
    b.messages.at(-1).data.args.join(" "),
    /Unhandled promise rejection: API failed/,
  );
  b.console.clear();
  assert.equal(b.messages.at(-1).data.level, "clear");
});

test("console messages are bounded and standalone pages keep native console behavior", () => {
  const b = browser();
  for (let i = 0; i < 100; i++)
    b.console.warn(...Array(20).fill("x".repeat(10000)));
  assert.equal(b.messages.length, 40);
  assert.equal(b.original.length, 100);
  for (const { data } of b.messages) {
    assert.ok(data.args.length <= 10);
    assert.ok(data.args.every((arg) => arg.length <= 4000));
    assert.ok(data.args.join("").length <= 16000);
  }
  const window = {};
  window.parent = window;
  const nativeLog = () => {};
  const context = { window, console: { log: nativeLog } };
  vm.runInNewContext(
    previewConsoleScript(["https://codeskill.example"]),
    context,
  );
  assert.equal(context.console.log, nativeLog);
});
