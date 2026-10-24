// Runs inside an untrusted, network-disabled container. Only the host controller
// owns stdin; stdout is a bounded JSONL protocol, never application output.
import fs from "node:fs/promises";
import http from "node:http";
import readline from "node:readline";
import { gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  contentHash,
  fileHashes,
  workspaceFiles,
  validWorkspaceDirectories,
} from "./workspace-files.mjs";
const root = "/work";
let children = [],
  logs = [],
  config,
  commandBusy = false,
  baseHashes = {},
  baseDirectories = [],
  instanceId = randomUUID();
const log = (text) => {
  logs.push(
    ...text
      .toString()
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
      .slice(0, 16000)
      .split("\n")
      .filter(Boolean),
  );
  logs = logs.slice(-160);
};
function kill(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {}
}
function launch(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", log);
  child.stderr.on("data", log);
  child.on("error", (e) => log(e.message));
  child.on("exit", (code) => log(`Process exited (${code})`));
  children.push(child);
}
function validFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > 100)
    throw Error("Invalid files");
  let bytes = 0;
  const seen = new Set();
  for (const f of files) {
    if (
      typeof f?.path !== "string" ||
      typeof f.content !== "string" ||
      !/^[a-zA-Z0-9_.@()\- /]+$/.test(f.path) ||
      f.path.length > 160 ||
      f.path.startsWith("/") ||
      f.path
        .split("/")
        .some(
          (p) =>
            !p ||
            [".", "..", "node_modules", ".git", "__pycache__"].includes(p),
        ) ||
      seen.has(f.path)
    )
      throw Error("Invalid file path");
    seen.add(f.path);
    const size = Buffer.byteLength(f.content);
    bytes += size;
    if (size > 200000 || bytes > 2000000) throw Error("Files too large");
  }
  for (const p of seen)
    if ([...seen].some((q) => q.startsWith(p + "/")))
      throw Error("Conflicting file path");
}
async function sync(files, folders) {
  validFiles(files);
  if (commandBusy)
    throw Error(
      "Wait for the current command to finish before saving runtime files",
    );
  // Keep terminal-created empty folders when applying saved editor files.
  const directories = validWorkspaceDirectories(
    folders ?? (await workspaceFiles(root)).directories,
    files,
  );
  children.forEach(kill);
  children = [];
  // Rebuild the disposable workspace so terminal-created symlinks cannot affect sync.
  for (const name of await fs.readdir(root))
    await fs.rm(`${root}/${name}`, { recursive: true, force: true });
  for (const f of files) {
    const path = `${root}/${f.path}`;
    await fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(path, f.content);
  }
  for (const directory of directories) {
    if (
      !files.some(
        (f) => f.path === directory || directory.startsWith(f.path + "/"),
      )
    )
      await fs.mkdir(`${root}/${directory}`, { recursive: true });
  }
  baseHashes = fileHashes(files);
  baseDirectories = directories;
  instanceId = randomUUID();
  for (const part of ["frontend", "backend"]) {
    await fs.mkdir(`${root}/${part}`, { recursive: true });
    await fs.symlink(
      "/opt/runtime/node_modules",
      `${root}/${part}/node_modules`,
    );
  }
  if (config.frontendStack)
    launch(
      "node",
      [
        config.frontendStack === "nextjs"
          ? "/opt/runtime/next-server.mjs"
          : "/opt/runtime/frontend.mjs",
      ],
      `${root}/frontend`,
      {
        PROJECT_PREVIEW_BASE: config.base,
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_OPTIONS:
          config.frontendStack === "nextjs"
            ? "--max-old-space-size=768"
            : "--max-old-space-size=384",
      },
    );
  if (config.backendStack === "express" || config.backendStack === "fastify")
    launch("node", ["--watch", "server.js"], `${root}/backend`);
  if (config.backendStack === "flask")
    launch(
      "python",
      [
        "-m",
        "flask",
        "--app",
        "main",
        "run",
        "--host=127.0.0.1",
        "--port=3001",
        "--reload",
      ],
      `${root}/backend`,
    );
  if (config.backendStack === "fastapi")
    launch(
      "python",
      [
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "3001",
        "--reload",
      ],
      `${root}/backend`,
    );
  if (config.backendStack === "springboot")
    launch(
      "/bin/sh",
      [
        "-c",
        "mvn -o -B -Dmaven.repo.local=/opt/m2 -DskipTests package && exec java -Xmx384m -XX:MaxMetaspaceSize=192m -XX:ActiveProcessorCount=1 -jar target/project.jar",
      ],
      `${root}/backend`,
      {
        MAVEN_OPTS:
          "-Xmx192m -XX:MaxMetaspaceSize=128m -XX:ActiveProcessorCount=1",
      },
    );
  log("Workspace files applied. Starting project servers…");
  return { synced: true };
}
async function request(data) {
  const {
    port,
    path,
    method = "GET",
    headers = {},
    body = "",
    compress = false,
  } = data;
  if (
    ![4173, 3001].includes(port) ||
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\r\n\\]/.test(path) ||
    !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
      method,
    )
  )
    throw Error("Invalid project request");
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          ...headers,
          host: "localhost",
          "accept-encoding": "identity",
        },
        timeout: port === 4173 ? 60000 : 10000,
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > (port === 4173 ? 24000000 : 2000000))
            req.destroy(Error("Project response exceeds its size limit"));
          else chunks.push(chunk);
        });
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const payload = compress ? gzipSync(raw) : raw;
          if (payload.length > 8000000)
            return reject(Error("Encoded project response exceeds 8 MB"));
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: payload.toString("base64"),
            bridgeEncoding: compress ? "gzip" : undefined,
            durationMs: Date.now() - started,
          });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(Error("Project request timed out")));
    req.on("error", reject);
    req.end(body);
  });
}
async function command(text) {
  if (commandBusy) throw Error("A command is already running");
  if (typeof text !== "string" || !text.trim() || text.length > 2000)
    throw Error("Invalid command");
  commandBusy = true;
  try {
    return await new Promise((resolve) => {
      const child = spawn("/bin/bash", ["-c", text], {
        cwd: root,
        detached: true,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "",
        timedOut = false;
      const collect = (chunk) => {
        output += chunk.toString();
        if (Buffer.byteLength(output) > 250000) {
          output = output.slice(0, 60000) + "\n[output truncated]";
          kill(child);
        }
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      const timer = setTimeout(() => {
        timedOut = true;
        kill(child);
      }, 15000);
      child.on("error", (e) => collect(e.message));
      child.on("close", (code) => {
        clearTimeout(timer);
        kill(child);
        resolve({ output, exitCode: code, timedOut });
      });
    });
  } finally {
    commandBusy = false;
  }
}
async function dispatch(msg) {
  if (msg.action === "init") {
    config = msg.data;
    return sync(config.files, config.directories || []);
  }
  if (msg.action === "sync") return sync(msg.data.files, msg.data.directories);
  if (msg.action === "files") {
    const snapshot = await workspaceFiles(root);
    const fingerprint = contentHash(
      JSON.stringify({ instanceId, ...snapshot }),
    );
    if (msg.data?.since === fingerprint) return { unchanged: true, instanceId };
    return {
      ...snapshot,
      instanceId,
      fingerprint,
      baseHashes,
      baseDirectories,
    };
  }
  if (msg.action === "request") return request(msg.data);
  if (msg.action === "logs") return { logs };
  if (msg.action === "command") return command(msg.data.command);
  throw Error("Unknown action");
}
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
input.on("line", (line) => {
  if (Buffer.byteLength(line) > 3000000) return process.exit(1);
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return process.exit(1);
  }
  void dispatch(msg)
    .then((data) =>
      process.stdout.write(JSON.stringify({ id: msg.id, data }) + "\n"),
    )
    .catch((error) =>
      process.stdout.write(
        JSON.stringify({ id: msg.id, error: error.message.slice(0, 200) }) +
          "\n",
      ),
    );
});
input.on("close", () => {
  children.forEach(kill);
  process.exit(0);
});
