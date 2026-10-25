import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const failure = (status, message) => Object.assign(Error(message), { status });

export function terminalSize(data) {
  const { cols, rows } = data || {};
  if (
    !Number.isInteger(cols) || !Number.isInteger(rows) ||
    cols < 20 || cols > 400 || rows < 4 || rows > 160
  ) throw failure(400, "Terminal size must be 20–400 columns and 4–160 rows");
  return { cols, rows };
}

export class TerminalSession {
  constructor(command, args, options = {}) {
    this.id = randomUUID();
    this.alive = true;
    this.sequence = 0;
    this.events = [];
    this.bytes = 0;
    this.waiters = new Set();
    this.startupWaiters = new Set();
    this.started = false;
    this.stderr = "";
    this.buffer = "";
    this.child = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      if (this.buffer.length > 131072) return this.close();
      let newline;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === "data" && typeof event.data === "string" && event.data.length <= 16384) {
            const data = Buffer.from(event.data, "base64");
            if (data.length) this.started = true;
            this.events.push({ sequence: ++this.sequence, data });
            this.bytes += data.length;
            while (this.bytes > 262144 || this.events.length > 2048)
              this.bytes -= this.events.shift().data.length;
            this.wake();
          } else if (event.type === "exit") {
            this.finish(Number.isInteger(event.exitCode) ? event.exitCode : null);
          } else this.close();
        } catch { this.close(); }
      }
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk).slice(0, 4096);
    });
    this.child.stdin.on("error", () => this.finish(null));
    this.child.on("error", () => this.finish(null));
    this.child.on("close", (code) => this.finish(this.exitCode ?? code));
    this.rateStart = Date.now();
    this.inputBytes = 0;
  }
  describe() {
    return { terminalId: this.id, alive: this.alive, exitCode: this.exitCode ?? null };
  }
  startupError() {
    const missingHelper = this.stderr.includes("/opt/runtime/terminal.py") &&
      /No such file|not found|can't open file/i.test(this.stderr);
    return failure(502, missingHelper
      ? "Bash terminal support is missing from this runtime. Ask an administrator to update it, then restart your project."
      : "Could not start Bash. Restart the project and try again.");
  }
  waitForStart(timeoutMs = 10000) {
    if (!this.alive) return Promise.reject(this.startupError());
    if (this.started) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.startupWaiters.delete(done);
      };
      const done = () => {
        if (this.alive && !this.started) return;
        cleanup();
        if (this.alive) resolve();
        else reject(this.startupError());
      };
      const timer = setTimeout(() => {
        cleanup();
        this.close();
        reject(failure(502, "Bash took too long to start. Restart the project and try again."));
      }, timeoutMs);
      this.startupWaiters.add(done);
      done();
    });
  }
  send(message) {
    if (!this.alive || this.child.stdin.destroyed)
      throw failure(409, "This shell has closed. Start a new Bash terminal.");
    if (this.child.stdin.writableLength > 65536)
      throw failure(429, "Terminal input is busy; try again shortly");
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }
  input(data) {
    if (typeof data !== "string" || !data.length || Buffer.byteLength(data) > 8192)
      throw failure(400, "Terminal input exceeds 8 KB");
    if (Date.now() - this.rateStart >= 1000) {
      this.rateStart = Date.now();
      this.inputBytes = 0;
    }
    this.inputBytes += Buffer.byteLength(data);
    if (this.inputBytes > 65536)
      throw failure(429, "Terminal input rate exceeded");
    this.send({ type: "input", data: Buffer.from(data).toString("base64") });
  }
  resize(data) {
    this.send({ type: "resize", ...terminalSize(data) });
  }
  snapshot(after) {
    const selected = [];
    let size = 0;
    for (const event of this.events) {
      if (event.sequence <= after) continue;
      if (size + event.data.length > 65536) break;
      selected.push(event);
      size += event.data.length;
    }
    return {
      ...this.describe(),
      cursor: selected.at(-1)?.sequence ?? this.sequence,
      data: Buffer.concat(selected.map((event) => event.data)).toString("base64"),
      truncated: Boolean(this.events.length && after < this.events[0].sequence - 1),
    };
  }
  read(after = 0) {
    if (!Number.isSafeInteger(after) || after < 0 || after > this.sequence)
      throw failure(400, "Invalid terminal output cursor");
    if (this.sequence > after || !this.alive) return Promise.resolve(this.snapshot(after));
    if (this.waiters.size >= 4) throw failure(429, "Too many terminal readers");
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters.delete(done);
        resolve(this.snapshot(after));
      };
      const timer = setTimeout(done, 15000);
      this.waiters.add(done);
    });
  }
  wake() {
    for (const done of [...this.startupWaiters]) done();
    for (const done of [...this.waiters]) done();
  }
  finish(exitCode) {
    this.alive = false;
    this.exitCode = exitCode;
    this.wake();
  }
  close() {
    if (this.alive) {
      try { this.child.stdin.end(JSON.stringify({ type: "close" }) + "\n"); } catch { /* already closed */ }
      const timer = setTimeout(() => this.child.kill("SIGTERM"), 1500);
      timer.unref();
      this.child.once("close", () => clearTimeout(timer));
    }
    this.finish(this.exitCode ?? null);
  }
}
