import test from "node:test";
import assert from "node:assert/strict";
import { TerminalSession, terminalSize } from "./terminal.mjs";

const echo = `
const readline=require('node:readline');
const send=data=>console.log(JSON.stringify({type:'data',data:Buffer.from(data).toString('base64')}));
send('ready');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.type==='input') send(Buffer.from(m.data,'base64'));
 else if(m.type==='resize') send(m.cols+'x'+m.rows);
 else process.exit(0);
});`;

test("terminal transports Unicode/control keys, resize events and resumable output", async (t) => {
  const session = new TerminalSession(process.execPath, ["-e", echo]);
  t.after(() => session.close());
  const initial = await session.read(0);
  assert.equal(Buffer.from(initial.data, "base64").toString(), "ready");
  session.input("printf café\r\x03");
  const reply = await session.read(initial.cursor);
  assert.equal(Buffer.from(reply.data, "base64").toString(), "printf café\r\x03");
  session.resize({ cols: 120, rows: 30 });
  const resized = await session.read(reply.cursor);
  assert.equal(Buffer.from(resized.data, "base64").toString(), "120x30");
  assert.throws(() => session.read(-1));
  assert.throws(() => session.read(999999));
  assert.throws(() => session.input("x".repeat(8193)));
  session.close();
  const closed = await session.read(resized.cursor);
  assert.equal(closed.alive, false);
  assert.throws(() => session.input("pwd\r"));
});

test("terminal scrollback and each read are bounded, with cursor-based recovery", async (t) => {
  const source = `for(let i=0;i<90;i++)console.log(JSON.stringify({type:'data',data:Buffer.alloc(4096,120).toString('base64')})); process.stdin.resume();`;
  const session = new TerminalSession(process.execPath, ["-e", source]);
  t.after(() => session.close());
  await new Promise((resolve) => session.child.stdout.on("data", () => { if(session.sequence===90) resolve(); }));
  assert.ok(session.bytes <= 262144);
  const page = await session.read(0);
  assert.equal(page.truncated, true);
  assert.ok(Buffer.from(page.data, "base64").length <= 65536);
  assert.ok(page.cursor < session.sequence);
  assert.ok((await session.read(page.cursor)).cursor > page.cursor);
});

test("PTY dimensions reject impossible terminal sizes", () => {
  for (const value of [{ cols: 10, rows: 24 }, { cols: 80, rows: 999 }, { cols: "80", rows: 24 }])
    assert.throws(() => terminalSize(value));
  assert.deepEqual(terminalSize({ cols: 80, rows: 24 }), { cols: 80, rows: 24 });
});

test("a shell is ready only after its PTY emits output", async (t) => {
  const session = new TerminalSession(process.execPath, ["-e", echo]);
  t.after(() => session.close());
  await session.waitForStart();
  assert.equal(session.describe().alive, true);
  assert.equal(Buffer.from(session.snapshot(0).data, "base64").toString(), "ready");
});

test("an outdated image reports missing terminal support instead of a connected shell", async (t) => {
  const session = new TerminalSession(process.execPath, ["-e", `process.stderr.write("python3: can't open file '/opt/runtime/terminal.py': No such file or directory\\n"); process.exitCode=2;`]);
  t.after(() => session.close());
  await assert.rejects(session.waitForStart(), (error) => error.status === 502 && /support is missing/.test(error.message));
  assert.equal(session.describe().alive, false);
  assert.equal(session.describe().exitCode, 2);
});

test("a stalled shell startup times out and stops its child process", async (t) => {
  const session = new TerminalSession(process.execPath, ["-e", "process.stdin.resume();"]);
  t.after(() => session.close());
  await assert.rejects(session.waitForStart(30), (error) => error.status === 502 && /too long/.test(error.message));
  assert.equal(session.describe().alive, false);
  assert.equal(session.startupWaiters.size, 0);
});
