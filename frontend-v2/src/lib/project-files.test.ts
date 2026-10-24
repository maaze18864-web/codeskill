import { TextEncoder } from "node:util";
import { mergeProjectFiles } from "./project-files";
import type { ProjectFile } from "./project-workspace";
Object.assign(globalThis, { TextEncoder });
const hashes = (files: ProjectFile[]) =>
  Object.fromEntries(files.map((f) => [f.path, f.content]));
const f = (path: string, content = "original") => ({ path, content });
const merge = (
  base: ProjectFile[],
  local: ProjectFile[],
  remote: ProjectFile[],
  complete = true,
) =>
  mergeProjectFiles(
    local,
    remote,
    hashes(base),
    hashes(local),
    hashes(remote),
    complete,
  );

describe("Runtime explorer merge", () => {
  it("handles Linux filenames that also name JavaScript object properties", () => {
    const local = [f("main.js")];
    const remote = [...local, f("constructor"), f("toString"), f("__proto__")];
    expect(merge(local, local, remote).files).toEqual(remote);
  });
  it("imports created files, edits, renamed files and deletions", () => {
    const base = [f("main.js"), f("old.txt")];
    const remote = [f("main.js", "terminal edit"), f("new/hello.txt", "hello")];
    const result = merge(base, base, remote);
    expect(result.files).toEqual(remote);
    expect(result.conflicts).toEqual([]);
  });
  it("preserves unapplied editor drafts, creations and deletions", () => {
    const base = [f("main.js"), f("removed.txt")];
    const local = [f("main.js", "editor draft"), f("editor.txt")];
    expect(merge(base, local, base).files).toBe(local);
  });
  it("keeps conflicting editor edits and reports the path", () => {
    const base = [f("main.js")],
      local = [f("main.js", "editor draft")];
    const result = merge(base, local, [f("main.js", "Bash edit")]);
    expect(result.files).toBe(local);
    expect(result.conflicts).toEqual(["main.js"]);
    expect(merge(base, local, []).conflicts).toEqual(["main.js"]);
  });
  it("does not delete files when the filesystem scan is incomplete", () => {
    const base = [f("main.js"), f("temporarily-unreadable.txt")];
    expect(merge(base, base, [base[0]], false).files).toBe(base);
  });
  it("protects file limits and file/directory collisions", () => {
    const local = [f("main.js")];
    expect(
      merge(local, local, [
        f("main.js"),
        ...Array.from({ length: 100 }, (_, n) => f(`a${n}.txt`)),
      ]).files,
    ).toBe(local);
    const result = merge([], local, [f("main.js/child")]);
    expect(result.files).toBe(local);
    expect(result.conflicts).toEqual(["main.js/child"]);
  });
});
