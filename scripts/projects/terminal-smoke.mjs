// Explicit local integration test. Changes only disposable files in the supplied
// running project and closes its shell; saved project files are never updated.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.PROJECT_TEST_API || "http://127.0.0.1:5001/api";
const project = process.env.PROJECT_TEST_PROJECT_ID;
const token = process.env.PROJECT_TEST_TOKEN;
if (!project || !token) throw Error("Set PROJECT_TEST_PROJECT_ID and PROJECT_TEST_TOKEN for a running test workspace");
async function call(path, method = "GET", data, authenticated = true) {
  const response = await fetch(`${base}/projects/${project}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  return { status: response.status, data: await response.json() };
}
const started = await call("/terminal", "POST", { cols: 120, rows: 30 });
assert.equal(started.status, 201, JSON.stringify(started.data));
const path = `/terminal/${started.data.terminalId}`;
let cursor = 0;
async function readUntil(marker, timeout = 10000) {
  let output = "";
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await call(`${path}?after=${cursor}`);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    cursor = result.data.cursor;
    output += Buffer.from(result.data.data, "base64").toString();
    if (output.includes(marker)) return output;
    assert.ok(result.data.alive, output);
  }
  throw Error(`Timed out waiting for ${marker}`);
}
async function input(data) {
  const result = await call(`${path}/input`, "POST", { data });
  assert.equal(result.status, 201, JSON.stringify(result.data));
}
async function command(source, timeout) {
  const marker = `__cs_done_${randomUUID()}__`;
  await input(`${source}\rprintf '\\n__cs_done_%s__\\n' '${marker.slice(10, -2)}'\r`);
  const output = await readUntil(marker, timeout);
  return output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r/g, "");
}
try {
  await readUntil("codeskill");
  const system = await command("printf '%s-%s\\n' BASH \"${BASH_VERSINFO[0]}\"; tty; id -u; uname -s");
  assert.match(system, /BASH-5/);
  assert.match(system, /\/dev\/pts\/\d+/);
  assert.match(system, /\r?\n1000\r?\n/);
  assert.match(system, /\r?\nLinux\r?\n/);
  await command("cd /work/frontend; export CODESKILL_TERMINAL_CHECK=remembered");
  const persistent = await command("pwd; printf '%s\\n' \"$CODESKILL_TERMINAL_CHECK\"; printf 'b\\na\\n' | sort | head -1");
  assert.match(persistent, /\/work\/frontend/);
  assert.match(persistent, /\r?\nremembered\r?\n/);
  assert.match(persistent, /\r?\na\r?\n/);
  await command("mkdir -p /tmp/codeskill-terminal-check; printf 'alpha\\nbeta\\n' > /tmp/codeskill-terminal-check/test.txt");
  const files = await command("grep beta /tmp/codeskill-terminal-check/test.txt; wc -l < /tmp/codeskill-terminal-check/test.txt; command -v git curl nano tree");
  assert.match(files, /\r?\nbeta\r?\n/);
  assert.match(files, /\r?\n2\r?\n/);
  for (const tool of ["git", "curl", "nano", "tree"]) assert.match(files, new RegExp(`/usr/bin/${tool}`));
  await input("python -c \"name=input('name? '); print('hello ' + name)\"\r");
  await readUntil("name? ");
  await input("Ada\r");
  await readUntil("hello Ada");
  await input("sleep 30\r");
  await readUntil("sleep 30");
  await input("\x03");
  await command("printf '%s-%s\\n' interrupt works", 5000);
  assert.equal((await call(`${path}/size`, "PUT", { cols: 100, rows: 32 })).status, 200);
  assert.match(await command("stty size"), /32 100/);
  assert.equal((await call(path, "GET", undefined, false)).status, 401);
  assert.equal((await call(`${path}/size`, "PUT", { cols: 0, rows: 32 })).status, 400);
  assert.equal((await call(`${path}/input`, "POST", { data: "x".repeat(8193) })).status, 400);
  await command("rm -rf /tmp/codeskill-terminal-check; cd /work");
  console.log("PASS: Linux Bash PTY, persistent cd/env, pipes, file commands, interactive stdin, Ctrl+C, resize, authentication and input limits.");
} finally {
  await call(path, "DELETE");
}
