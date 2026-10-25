// Trusted controller: run on a dedicated sandbox host, never on the app/judge VM.
import http from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { TerminalSession, terminalSize } from "./terminal.mjs";
import {
  instrumentPreviewHtml,
  previewConsoleScript,
} from "./preview-console.mjs";
const exec = promisify(execFile);
export function dockerRunArgs(name, image, memoryMb = 1024) {
  return [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "--label",
    "codeskill.project-runtime=1",
    "--network",
    "none",
    "--user",
    "1000:1000",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges=true",
    "--cpus",
    memoryMb > 1024 ? "2" : "1",
    "--memory",
    `${memoryMb}m`,
    "--memory-swap",
    `${memoryMb}m`,
    "--pids-limit",
    "128",
    "--ulimit",
    "nofile=1024:1024",
    "--tmpfs",
    "/work:rw,exec,nosuid,size=268435456,uid=1000,gid=1000",
    "--tmpfs",
    "/tmp:rw,exec,nosuid,size=134217728,uid=1000,gid=1000",
    "--log-driver",
    "local",
    "--log-opt",
    "max-size=1m",
    "--log-opt",
    "max-file=2",
    image,
  ];
}
export function relativePath(path) {
  return (
    typeof path === "string" &&
    path.length <= 2000 &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/[\r\n\\]/.test(path)
  );
}
export function projectRuntimeUrls(frontend, backend, origin, capability) {
  const base = `${origin}/p/${capability}/`;
  return {
    previewUrl: frontend ? base : null,
    backendUrl: backend
      ? `${base}__backend/`
      : frontend === "nextjs"
        ? base
        : null,
  };
}
export function requestHeaders(raw) {
  let input = raw || {};
  if (typeof raw === "string") {
    try {
      input = JSON.parse(raw || "{}");
    } catch {
      throw Error("Headers must be a JSON object");
    }
  }
  if (
    !input ||
    Array.isArray(input) ||
    typeof input !== "object" ||
    Object.keys(input).length > 30
  )
    throw Error("Invalid headers");
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !/^[a-zA-Z0-9-]+$/.test(key) ||
      typeof value !== "string" ||
      value.length > 4000 ||
      /[\r\n]/.test(value)
    )
      throw Error("Invalid header");
    if (
      /^(host|connection|upgrade|cookie|set-cookie|content-length|transfer-encoding|proxy-.*|x-forwarded-.*|forwarded|accept-encoding)$/i.test(
        key,
      )
    )
      continue;
    result[key.toLowerCase()] = value;
  }
  return result;
}
export function localPreviewPort(start, occupied = [], end = 65535) {
  const first = Number(start);
  const last = Number(end);
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(last) ||
    first < 1024 ||
    last > 65535 ||
    first > last
  )
    throw Error("Invalid local preview port range");
  const used = new Set(occupied.filter(Number.isInteger));
  for (let port = first; port <= last; port++) if (!used.has(port)) return port;
  throw Error("No local preview ports are available");
}
export function previewFrameAncestors(appOrigin, localPreviewOrigins = false) {
  const app = new URL(appOrigin);
  const origins = new Set([app.origin]);
  if (
    localPreviewOrigins &&
    app.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname)
  ) {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      const alias = new URL(app.origin);
      alias.hostname = hostname;
      origins.add(alias.origin);
    }
  }
  return [...origins].join(" ");
}
function error(status, message) {
  return Object.assign(Error(message), { status });
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 3000000) throw error(413, "Request too large");
    chunks.push(c);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  } catch {
    throw error(400, "Invalid JSON");
  }
}
class Bridge {
  constructor(args, name) {
    this.pending = new Map();
    this.sequence = 0;
    this.buffer = "";
    this.child = spawn(
      "docker",
      [...args, "exec", "-i", name, "node", "/opt/runtime/bridge.mjs"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();
      if (this.buffer.length > 12000000) return this.child.kill();
      let newline;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        let msg;
        try {
          msg = JSON.parse(this.buffer.slice(0, newline));
        } catch {
          this.child.kill();
          break;
        }
        this.buffer = this.buffer.slice(newline + 1);
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          msg.error ? p.reject(error(400, msg.error)) : p.resolve(msg.data);
        }
      }
    });
    this.child.stderr.resume();
    const close = () => {
      this.closed = true;
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(error(502, "Runtime stopped"));
      }
      this.pending.clear();
    };
    this.child.on("error", close);
    this.child.on("close", close);
  }
  call(action, data, timeout = 22000) {
    if (this.closed || this.pending.size >= 40)
      return Promise.reject(error(429, "Runtime is busy or stopped"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(error(504, "Runtime timed out"));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        JSON.stringify({ id, action, data }) + "\n",
        (err) => {
          if (err) {
            clearTimeout(timer);
            this.pending.delete(id);
            reject(error(502, "Runtime connection lost"));
          }
        },
      );
    });
  }
  close() {
    this.child.kill();
  }
}
export async function createRunner(env = process.env) {
  const token = env.PROJECT_RUNNER_TOKEN;
  if (!token || token.length < 32 || !env.PROJECT_DOCKER_CONTEXT)
    throw Error(
      "Set a 32+ character PROJECT_RUNNER_TOKEN and a dedicated PROJECT_DOCKER_CONTEXT",
    );
  const args = ["--context", env.PROJECT_DOCKER_CONTEXT];
  const image = env.PROJECT_RUNTIME_IMAGE || "codeskill-project-runtime:local";
  const previewOrigin = new URL(
    env.PROJECT_PREVIEW_ORIGIN || "http://localhost:5081",
  );
  const localPreviewOrigins =
    previewOrigin.protocol === "http:" &&
    previewOrigin.hostname === "localhost";
  const appOrigin = new URL(env.PROJECT_APP_ORIGIN || "http://127.0.0.1:3000");
  if (
    previewOrigin.origin === appOrigin.origin ||
    (!localPreviewOrigins && previewOrigin.hostname === appOrigin.hostname)
  )
    throw Error("Preview must use a separate origin from the application");
  const frameAncestors = previewFrameAncestors(appOrigin, localPreviewOrigins);
  const capacity = Math.max(
    1,
    Math.min(20, Number(env.PROJECT_MAX_SESSIONS || 2)),
  );
  const idleMs = Number(env.PROJECT_IDLE_MINUTES || 20) * 60000,
    maxMs = Number(env.PROJECT_MAX_MINUTES || 60) * 60000;
  if (
    ![capacity, idleMs, maxMs].every(Number.isFinite) ||
    idleMs <= 0 ||
    maxMs <= 0
  )
    throw Error("Invalid runtime limits");
  const memoryBudget = Number(env.PROJECT_MEMORY_BUDGET_MB || 2048);
  if (!Number.isFinite(memoryBudget) || memoryBudget < 1024)
    throw Error("Invalid project memory budget");
  const sessions = new Map();
  const recent = new Map();
  const issuedLocalPreviewPorts = new Set();
  const docker = async (...command) =>
    (
      await exec("docker", [...args, ...command], {
        timeout: 30000,
        maxBuffer: 1000000,
      })
    ).stdout.trim();
  // This daemon must be dedicated. Reclaim only our explicitly labelled leftovers.
  const leftovers = await docker(
    "ps",
    "-aq",
    "--filter",
    "label=codeskill.project-runtime=1",
  );
  if (leftovers) await docker("rm", "-f", ...leftovers.split("\n"));
  async function stop(s, state = "stopped") {
    if (!s) return;
    s.state = state;
    s.bridge?.close();
    s.terminal?.close();
    for (const tunnel of s.tunnels || []) {
      tunnel.socket.destroy();
      tunnel.child.kill();
    }
    if (s.previewServers?.length) {
      const servers = s.previewServers;
      s.previewServers = [];
      for (const server of servers) server.closeAllConnections?.();
      await Promise.all(
        servers.map(
          (server) => new Promise((resolve) => server.close(resolve)),
        ),
      );
    }
    try {
      await docker("rm", "-f", s.name);
    } catch {
      /* already removed */
    }
    if (sessions.get(s.id) === s) sessions.delete(s.id);
  }
  function previewAddress(s) {
    const url = new URL(previewOrigin.origin);
    url.hostname = s.previewHost;
    if (localPreviewOrigins) url.port = String(s.previewPort);
    return url;
  }
  function view(s) {
    if (!s)
      return { state: "stopped", logs: [], previewUrl: null, backendUrl: null };
    return {
      state: s.bridge?.closed ? "failed" : s.state,
      logs: s.logs || [],
      memoryMb: s.memoryMb || 1024,
      cpus: s.memoryMb > 1024 ? 2 : 1,
      revision: s.revision || 0,
      ...(s.state === "ready" && !s.bridge?.closed
        ? projectRuntimeUrls(
            s.frontendStack,
            s.backendStack,
            previewAddress(s).origin,
            s.cap,
          )
        : { previewUrl: null, backendUrl: null }),
      expiresAt: new Date(
        Math.min(s.started + maxMs, s.touched + idleMs),
      ).toISOString(),
      frontendStack: s.frontendStack,
      backendStack: s.backendStack,
    };
  }
  async function ready(s) {
    const deadline = Date.now() + 80000;
    while (Date.now() < deadline) {
      if (s.cancelled || sessions.get(s.id) !== s || s.bridge.closed)
        throw error(502, "Project runtime stopped during startup");
      try {
        if (s.frontendStack)
          await s.bridge.call(
            "request",
            {
              port: 4173,
              path:
                s.frontendStack === "nextjs" ? `/p/${s.cap}` : `/p/${s.cap}/`,
            },
            s.frontendStack === "nextjs"
              ? Math.min(65000, deadline - Date.now())
              : 1500,
          );
        if (s.backendStack)
          await s.bridge.call("request", { port: 3001, path: "/health" }, 1500);
        s.state = "ready";
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw error(502, "Project did not start. Check the console for errors.");
  }
  const api = http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const auth = Buffer.from(req.headers.authorization || "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (auth.length !== expected.length || !timingSafeEqual(auth, expected))
        throw error(401, "Unauthorized");
      if (req.url === "/health" && req.method === "GET")
        return send(200, { status: "ok", active: sessions.size, capacity });
      const requestUrl = new URL(req.url || "/", "http://runner");
      const match =
        /^\/projects\/([a-f0-9-]{36})\/(runtime|files|heartbeat|request|command|terminal)(?:\/([a-f0-9-]{36})(?:\/(input|size))?)?$/.exec(
          requestUrl.pathname,
        );
      const owner = req.headers["x-project-owner"];
      if (!match || typeof owner !== "string" || !/^[a-f0-9-]{36}$/.test(owner))
        throw error(400, "Invalid project request");
      const [, id, action, terminalId, terminalAction] = match;
      if (action !== "terminal" && terminalId) throw error(404, "Not found");
      const last = recent.get(id);
      if (last && last.owner !== owner) throw error(404, "Runtime not found");
      let s = sessions.get(id);
      if (s && s.owner !== owner) throw error(404, "Runtime not found");
      if (action === "runtime" && req.method === "POST") {
        recent.delete(id);
        if (s) {
          if (s.state === "starting")
            throw error(409, "Project is already starting");
          await stop(s);
        }
        if ([...sessions.values()].some((x) => x.owner === owner))
          throw error(409, "Stop your other project before starting this one.");
        if (sessions.size >= capacity)
          throw error(
            429,
            "All project sandboxes are in use. Try again shortly.",
          );
        // Reserve before awaiting body/start to make concurrent requests respect quotas.
        s = {
          id,
          owner,
          name: `cs-project-${randomBytes(12).toString("hex")}`,
          cap: randomBytes(24).toString("hex"),
          started: Date.now(),
          touched: Date.now(),
          state: "starting",
          logs: [],
        };
        s.previewHost = localPreviewOrigins
          ? previewOrigin.hostname
          : `${s.cap}.${previewOrigin.hostname}`;
        sessions.set(id, s);
        try {
          const data = await body(req);
          if (
            (!data.frontendStack && !data.backendStack) ||
            (data.frontendStack &&
              !["html", "react", "vue", "svelte", "nextjs"].includes(
                data.frontendStack,
              )) ||
            (data.backendStack &&
              ![
                "express",
                "fastify",
                "flask",
                "fastapi",
                "springboot",
              ].includes(data.backendStack))
          )
            throw error(400, "Unsupported project stack");
          s.revision = Number.isInteger(data.revision) ? data.revision : 0;
          s.frontendStack = data.frontendStack;
          s.backendStack = data.backendStack;
          s.memoryMb =
            data.frontendStack === "nextjs" &&
            data.backendStack === "springboot"
              ? 2048
              : data.frontendStack === "nextjs" ||
                  data.backendStack === "springboot"
                ? 1536
                : 1024;
          if (
            [...sessions.values()].reduce(
              (sum, x) => sum + (x.memoryMb || 1024),
              0,
            ) > memoryBudget
          )
            throw error(
              429,
              "Not enough sandbox memory available. Stop another project and try again.",
            );
          if (localPreviewOrigins) await startLocalPreview(s);
          await docker(...dockerRunArgs(s.name, image, s.memoryMb));
          if (s.cancelled) throw error(409, "Project start cancelled");
          s.bridge = new Bridge(args, s.name);
          await s.bridge.call("init", { ...data, base: `/p/${s.cap}/` });
          await ready(s);
          s.logs = (await s.bridge.call("logs")).logs;
          return send(200, view(s));
        } catch (e) {
          s.logs = s.bridge
            ? (await s.bridge.call("logs").catch(() => ({ logs: [] }))).logs
            : [];
          console.error(`Project startup failed: ${e.message}`);
          await stop(s);
          recent.set(id, {
            ...s,
            state: "failed",
            bridge: null,
            logs: [
              ...s.logs,
              e.status ? e.message : "Sandbox could not start.",
            ],
          });
          throw e;
        }
      }
      if (action === "runtime" && req.method === "DELETE") {
        recent.delete(id);
        if (s) s.cancelled = true;
        await stop(s);
        return send(200, view(null));
      }
      if (action === "runtime" && req.method === "GET") {
        if (s?.bridge)
          s.logs = (
            await s.bridge.call("logs").catch(() => ({ logs: s.logs }))
          ).logs;
        return send(200, view(s || last));
      }
      if (!s?.bridge || s.state !== "ready")
        throw error(409, "Run the project first");
      if (action === "files" && req.method === "GET") {
        if (s.syncing) throw error(409, "Workspace files are being applied");
        const since = requestUrl.searchParams.get("since") || "";
        if (since && !/^[a-f0-9]{64}$/.test(since))
          throw error(400, "Invalid file fingerprint");
        return send(200, await s.bridge.call("files", { since }));
      }
      if (action === "terminal") {
        if (s.syncing)
          throw error(409, "Wait for workspace files to finish applying");
        if (!terminalId && req.method === "POST") {
          const size = terminalSize(await body(req));
          if (!s.terminal?.alive) {
            s.terminal?.close();
            s.terminal = new TerminalSession("docker", [
              ...args,
              "exec",
              "-i",
              "--workdir",
              "/work",
              s.name,
              "python3",
              "/opt/runtime/terminal.py",
              "--cols",
              String(size.cols),
              "--rows",
              String(size.rows),
            ]);
          }
          const terminal = s.terminal;
          await terminal.waitForStart();
          terminal.resize(size);
          s.touched = Date.now();
          return send(200, terminal.describe());
        }
        if (!terminalId || s.terminal?.id !== terminalId)
          throw error(404, "Terminal session not found");
        if (!terminalAction && req.method === "GET")
          return send(
            200,
            await s.terminal.read(
              Number(requestUrl.searchParams.get("after") || 0),
            ),
          );
        if (terminalAction === "input" && req.method === "POST") {
          s.terminal.input((await body(req)).data);
          s.touched = Date.now();
          return send(200, { accepted: true });
        }
        if (terminalAction === "size" && req.method === "PUT") {
          s.terminal.resize(await body(req));
          return send(200, { resized: true });
        }
        if (!terminalAction && req.method === "DELETE") {
          s.terminal.close();
          return send(200, s.terminal.describe());
        }
        throw error(404, "Not found");
      }
      if (action === "heartbeat" && req.method === "POST") {
        s.touched = Date.now();
        return send(200, view(s));
      }
      if (action === "files" && req.method === "PUT") {
        if (s.syncing || s.commanding)
          throw error(409, "Runtime is busy; try syncing again");
        s.syncing = true;
        try {
          const update = await body(req);
          s.terminal?.close();
          s.terminal = null;
          await s.bridge.call("sync", update);
          s.revision = Number.isInteger(update.revision) ? update.revision : 0;
          s.state = "starting";
          await ready(s);
        } finally {
          s.syncing = false;
        }
        return send(200, view(s));
      }
      if (action === "command" && req.method === "POST") {
        if (s.commanding || s.syncing) throw error(409, "Runtime is busy");
        s.commanding = true;
        try {
          return send(200, await s.bridge.call("command", await body(req)));
        } finally {
          s.commanding = false;
        }
      }
      if (action === "request" && req.method === "POST") {
        if (!s.backendStack && s.frontendStack !== "nextjs")
          throw error(400, "Project has no backend");
        const data = await body(req);
        if (
          !relativePath(data.path) ||
          (typeof data.body !== "undefined" &&
            (typeof data.body !== "string" || data.body.length > 100000))
        )
          throw error(400, "Use a relative API path");
        let headers;
        try {
          headers = requestHeaders(data.headers);
        } catch (e) {
          throw error(400, e.message);
        }
        const response = await s.bridge.call("request", {
          port: s.backendStack ? 3001 : 4173,
          path: s.backendStack ? data.path : `/p/${s.cap}${data.path}`,
          method: data.method,
          headers,
          body: data.body || "",
        });
        return send(200, {
          ...response,
          body: Buffer.from(response.body, "base64").toString("utf8"),
        });
      }
      throw error(404, "Not found");
    } catch (e) {
      send(e.status || 502, {
        message: e.status
          ? e.message
          : "Project sandbox unavailable. Check runner logs.",
      });
    }
  });
  const previewHandler = async (req, res) => {
    try {
      const match = /^\/p\/([a-f0-9]{48})(\/.*)?$/.exec(req.url || "");
      const s =
        match &&
        [...sessions.values()].find(
          (x) => x.cap === match[1] && x.state === "ready",
        );
      if (!s?.bridge)
        throw error(
          404,
          "This preview has stopped or expired. Run the project again.",
        );
      const runtimeOrigin = previewAddress(s).origin;
      if (req.headers.host !== previewAddress(s).host)
        throw error(404, "Preview hostname does not match the project");
      const tail = match[2] || "/";
      const backend =
        s.backendStack && /^\/(?:api|__backend)(?:\/|\?|$)/.test(tail);
      const backendPath = tail.startsWith("/__backend")
        ? tail.slice("/__backend".length) || "/"
        : tail;
      if (!backend && !s.frontendStack) throw error(404, "No frontend");
      if (req.method === "GET" && tail === "/__codeskill_console.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(previewConsoleScript(frameAncestors.split(" ")));
      }
      // Sandboxed frames have an opaque origin. Handle their preflight here so
      // student APIs do not need platform-specific CORS middleware.
      if (
        req.method === "OPTIONS" &&
        req.headers["access-control-request-method"]
      ) {
        const requested = req.headers["access-control-request-headers"] || "";
        if (
          typeof requested !== "string" ||
          requested.length > 1000 ||
          requested
            .split(",")
            .some((name) => name.trim() && !/^[a-zA-Z0-9-]+$/.test(name.trim()))
        ) {
          throw error(400, "Invalid preflight headers");
        }
        res.writeHead(204, {
          "Access-Control-Allow-Origin": runtimeOrigin,
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": requested,
          "Cache-Control": "no-store",
          Vary: "Origin, Access-Control-Request-Headers",
        });
        return res.end();
      }
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 100000) throw error(413, "Request too large");
        chunks.push(c);
      }
      const previewHeaders = requestHeaders(req.headers);
      // This is an internal loopback request behind the capability/CSP boundary.
      // Do not forward browser provenance to a framework's private dev endpoints.
      for (const key of Object.keys(previewHeaders))
        if (key === "origin" || key === "referer" || key.startsWith("sec-"))
          delete previewHeaders[key];
      const projectResponse = await s.bridge.call(
        "request",
        {
          port: backend ? 3001 : 4173,
          path: backend
            ? backendPath.startsWith("/")
              ? backendPath
              : `/${backendPath}`
            : s.frontendStack === "nextjs" && tail === "/"
              ? `/p/${s.cap}`
              : req.url,
          method: req.method,
          headers: previewHeaders,
          body: Buffer.concat(chunks).toString(),
          compress:
            !backend && /\bgzip\b/.test(req.headers["accept-encoding"] || ""),
        },
        s.frontendStack === "nextjs" && !backend ? 65000 : 22000,
      );
      const response =
        !backend && req.method === "GET"
          ? instrumentPreviewHtml(
              projectResponse,
              `/p/${s.cap}/__codeskill_console.js`,
            )
          : projectResponse;
      const headers = {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": runtimeOrigin,
        "Access-Control-Expose-Headers": "*",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": `sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-downloads; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${runtimeOrigin} blob:; style-src 'unsafe-inline' ${runtimeOrigin}; img-src ${runtimeOrigin} data: blob:; font-src ${runtimeOrigin} data:; connect-src ${runtimeOrigin} ${runtimeOrigin.replace(/^http/, "ws")}; frame-ancestors ${frameAncestors}; form-action 'none'; base-uri 'none'`,
      };
      if (response.headers["content-type"])
        headers["Content-Type"] = response.headers["content-type"];
      if (response.bridgeEncoding === "gzip")
        headers["Content-Encoding"] = "gzip";
      const location = response.headers.location;
      if (typeof location === "string" && relativePath(location)) {
        const scope = `/p/${s.cap}`;
        const scoped = new URL(
          location.startsWith(scope) ? location : scope + location,
          previewOrigin,
        );
        if (
          scoped.pathname === scope ||
          scoped.pathname.startsWith(scope + "/")
        )
          headers.Location = scoped.pathname + scoped.search + scoped.hash;
      }
      res.writeHead(response.status, headers);
      res.end(Buffer.from(response.body, "base64"));
    } catch (e) {
      res.writeHead(e.status || 502, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
      res.end(
        e.status ? e.message : "Preview unavailable. Check project logs.",
      );
    }
  };
  const preview = http.createServer(previewHandler);
  const previewIPv6 = http.createServer(previewHandler);
  const handlePreviewUpgrade = (req, socket, head) => {
    const match = /^\/p\/([a-f0-9]{48})\/_next\//.exec(req.url || "");
    const s =
      match &&
      [...sessions.values()].find(
        (x) =>
          x.cap === match[1] &&
          x.state === "ready" &&
          x.frontendStack === "nextjs",
      );
    if (
      !s ||
      req.headers.host !== previewAddress(s).host ||
      req.headers.origin !== previewAddress(s).origin ||
      head.length > 65536 ||
      (s.tunnels?.size || 0) >= 2
    ) {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string" || !/^[A-Za-z0-9+/=]{16,32}$/.test(key)) {
      socket.destroy();
      return;
    }
    const child = spawn(
      "docker",
      [...args, "exec", "-i", s.name, "node", "/opt/runtime/ws-tunnel.mjs"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const tunnel = { socket, child };
    s.tunnels ||= new Set();
    s.tunnels.add(tunnel);
    const lines = [
      `GET ${req.url} HTTP/1.1`,
      "Host: localhost",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
    ];
    const protocol = req.headers["sec-websocket-protocol"];
    if (
      typeof protocol === "string" &&
      /^[A-Za-z0-9_,. -]{1,200}$/.test(protocol)
    )
      lines.push(`Sec-WebSocket-Protocol: ${protocol}`);
    child.stdin.on("error", () => socket.destroy());
    child.stdout.on("error", () => socket.destroy());
    child.stderr.resume();
    child.on("error", () => socket.destroy());
    child.on("close", () => socket.destroy());
    socket.on("error", () => child.kill());
    socket.on("close", () => {
      s.tunnels.delete(tunnel);
      child.kill();
    });
    socket.setTimeout(240000, () => socket.destroy());
    child.stdin.write(lines.join("\r\n") + "\r\n\r\n");
    if (head.length) child.stdin.write(head);
    socket.pipe(child.stdin);
    child.stdout.pipe(socket);
  };
  preview.on("upgrade", handlePreviewUpgrade);
  previewIPv6.on("upgrade", handlePreviewUpgrade);
  async function startLocalPreview(s) {
    const firstPort = Number(env.PROJECT_PREVIEW_PORT || 5081);
    while (true) {
      const port = localPreviewPort(firstPort, [...issuedLocalPreviewPorts]);
      const servers = ["127.0.0.1", "::1"].map((host) => {
        const server = http.createServer(previewHandler);
        server.on("upgrade", handlePreviewUpgrade);
        return { host, server };
      });
      try {
        for (const { host, server } of servers)
          await new Promise((resolve, reject) => {
            const onError = (e) => {
              server.off("listening", onListening);
              reject(e);
            };
            const onListening = () => {
              server.off("error", onError);
              resolve();
            };
            server.once("error", onError);
            server.once("listening", onListening);
            server.listen(port, host);
          });
        s.previewPort = port;
        s.previewServers = servers.map(({ server }) => server);
        issuedLocalPreviewPorts.add(port);
        return;
      } catch (e) {
        await Promise.all(
          servers.map(
            ({ server }) =>
              new Promise((resolve) => {
                if (!server.listening) return resolve();
                server.closeAllConnections?.();
                server.close(resolve);
              }),
          ),
        );
        if (e.code !== "EADDRINUSE") throw e;
        issuedLocalPreviewPorts.add(port);
      }
    }
  }
  const timer = setInterval(() => {
    for (const [id, s] of recent)
      if (Date.now() - s.started > maxMs) recent.delete(id);
    for (const s of sessions.values())
      if (Date.now() > Math.min(s.started + maxMs, s.touched + idleMs))
        void stop(s, "expired");
  }, 15000);
  timer.unref();
  const close = async () => {
    clearInterval(timer);
    await Promise.all([...sessions.values()].map((s) => stop(s)));
    for (const server of [api, preview, previewIPv6])
      if (server.listening) server.close();
  };
  return { api, preview, previewIPv6, localPreviewOrigins, close };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const runner = await createRunner();
  runner.api.listen(
    Number(process.env.PROJECT_RUNNER_PORT || 5080),
    "127.0.0.1",
    () => console.log("Project controller listening on loopback"),
  );
  if (!runner.localPreviewOrigins) {
    const previewPort = Number(process.env.PROJECT_PREVIEW_PORT || 5081);
    const previewBind = process.env.PROJECT_PREVIEW_BIND || "127.0.0.1";
    const previewHosts =
      previewBind === "127.0.0.1" ? ["127.0.0.1", "::1"] : [previewBind];
    for (const host of previewHosts) {
      const server = host === "::1" ? runner.previewIPv6 : runner.preview;
      server.listen(previewPort, host, () =>
        console.log(`Project preview listening on ${host}`),
      );
    }
  }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => void runner.close().then(() => process.exit(0)));
}
