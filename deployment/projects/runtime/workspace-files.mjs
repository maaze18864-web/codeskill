import fs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const excluded = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  ".next",
  "target",
  "dist",
  "build",
  ".cache",
  ".vite",
  ".venv",
  "venv",
  "coverage",
  ".gradle",
]);
export const contentHash = (content) =>
  createHash("sha256").update(content).digest("hex");
export const fileHashes = (files) =>
  Object.fromEntries(files.map((f) => [f.path, contentHash(f.content)]));

export function validWorkspaceDirectories(directories, files) {
  if (!Array.isArray(directories) || directories.length > 500)
    throw Error("Invalid folders");
  for (const directory of directories)
    if (
      typeof directory !== "string" ||
      !directory ||
      directory.length > 160 ||
      directory.startsWith("/") ||
      !/^[a-zA-Z0-9_.@()\- /]+$/.test(directory) ||
      directory
        .split("/")
        .some(
          (part) =>
            !part ||
            [".", "..", "node_modules", ".git", "__pycache__"].includes(part),
        ) ||
      files.some(
        (file) =>
          file.path === directory || directory.startsWith(file.path + "/"),
      )
    )
      throw Error("Invalid folder path");
  return [...new Set(directories)].sort();
}

// Enumerate only bounded text source files. Never follow symlinks, including
// the preinstalled node_modules links. Generated dependency/build trees are omitted.
export async function workspaceFiles(root) {
  const files = [],
    directories = [],
    omitted = [];
  let complete = true,
    visited = 0,
    bytes = 0;
  const rootPath = await fs.realpath(root);
  const omit = (name) => {
    complete = false;
    if (omitted.length < 10) omitted.push(name);
  };
  async function walk(relative = "") {
    const absolute = path.join(rootPath, relative);
    const actual = await fs.realpath(absolute);
    if (actual !== absolute) {
      omit(relative);
      return;
    }
    const entries = await fs.opendir(absolute);
    for await (const entry of entries) {
      if (++visited > 2000) {
        omit("workspace entry limit");
        break;
      }
      if (excluded.has(entry.name)) continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (name.length > 160 || !/^[a-zA-Z0-9_.@()\- /]+$/.test(name)) {
        omit(name);
        continue;
      }
      try {
        if (entry.isSymbolicLink()) {
          omit(name);
          continue;
        }
        if (entry.isDirectory()) {
          if (directories.length >= 500 || name.split("/").length > 20) {
            omit(name);
            continue;
          }
          directories.push(name);
          await walk(name);
        } else if (entry.isFile()) {
          if (files.length >= 100) {
            omit(name);
            continue;
          }
          const handle = await fs.open(
            path.join(absolute, entry.name),
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          try {
            const stat = await handle.stat();
            const openedPath = await fs.realpath(
              process.platform === "linux"
                ? `/proc/self/fd/${handle.fd}`
                : path.join(absolute, entry.name),
            );
            if (!openedPath.startsWith(rootPath + path.sep)) {
              omit(name);
              continue;
            }
            if (
              !stat.isFile() ||
              stat.size > 200000 ||
              bytes + stat.size > 2000000
            ) {
              omit(name);
              continue;
            }
            // A bounded read also handles files growing while the terminal writes.
            const buffer = Buffer.alloc(200001);
            const { bytesRead } = await handle.read(
              buffer,
              0,
              buffer.length,
              0,
            );
            const raw = buffer.subarray(0, bytesRead);
            let content;
            try {
              content = new TextDecoder("utf-8", { fatal: true }).decode(raw);
            } catch {
              omit(name);
              continue;
            }
            if (
              bytesRead > 200000 ||
              bytes + bytesRead > 2000000 ||
              raw.includes(0)
            ) {
              omit(name);
              continue;
            }
            bytes += bytesRead;
            files.push({ path: name, content });
          } finally {
            await handle.close();
          }
        } else omit(name);
      } catch {
        omit(name);
      } // A rename during scanning must not look like a deletion.
    }
  }
  await walk();
  files.sort((a, b) => a.path.localeCompare(b.path));
  directories.sort();
  return { files, directories, complete, omitted };
}
