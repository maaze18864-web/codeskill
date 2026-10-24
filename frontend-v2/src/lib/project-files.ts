import { validProjectPath, type ProjectFile } from "./project-workspace";

export interface ProjectFilesSnapshot {
  unchanged?: boolean;
  instanceId: string;
  fingerprint: string;
  files: ProjectFile[];
  directories: string[];
  baseHashes: Record<string, string>;
  baseDirectories?: string[];
  complete: boolean;
  omitted: string[];
}
export async function projectFileHashes(files: ProjectFile[]) {
  const encoder = new TextEncoder();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(file.content),
        );
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        return [file.path, hash];
      }),
    ),
  );
}

// Three-way merge protects editor drafts, including autosaved drafts that have
// not yet been applied to the container.
export function mergeProjectFiles(
  local: ProjectFile[],
  remote: ProjectFile[],
  baseHashes: Record<string, string>,
  localHashes: Record<string, string>,
  remoteHashes: Record<string, string>,
  complete: boolean,
) {
  const result = new Map(local.map((f) => [f.path, f]));
  const incoming = new Map(remote.map((f) => [f.path, f]));
  const conflicts: string[] = [];
  const paths = new Set([...Object.keys(baseHashes), ...incoming.keys()]);
  for (const path of paths) {
    const next = incoming.get(path);
    if (!next && !complete) continue;
    const before = Object.hasOwn(baseHashes, path)
        ? baseHashes[path]
        : undefined,
      here = Object.hasOwn(localHashes, path) ? localHashes[path] : undefined,
      there = Object.hasOwn(remoteHashes, path)
        ? remoteHashes[path]
        : undefined;
    if (here === there || there === before) continue;
    if (here !== before) {
      conflicts.push(path);
      continue;
    }
    if (next) {
      if (!validProjectPath(path, [...result.values()], path)) {
        conflicts.push(path);
        continue;
      }
      result.set(path, next);
    } else result.delete(path);
  }
  const files = [...result.values()];
  const encoder = new TextEncoder();
  const bytes = files.reduce(
    (sum, file) => sum + encoder.encode(file.content).length,
    0,
  );
  if (
    !files.length ||
    files.length > 100 ||
    bytes > 2000000 ||
    files.some((f) => encoder.encode(f.content).length > 200000)
  )
    return {
      files: local,
      conflicts: [...new Set([...conflicts, "project file limits"])],
    };
  const changed = JSON.stringify(files) !== JSON.stringify(local);
  return { files: changed ? files : local, conflicts };
}
