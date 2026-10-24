import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  workspaceFiles,
  fileHashes,
  validWorkspaceDirectories,
} from "./workspace-files.mjs";
test("runtime folder paths cannot escape the workspace or collide with source files", () => {
  const files = [{ path: "README.md", content: "" }];
  assert.deepEqual(
    validWorkspaceDirectories(["src/empty", "src/empty"], files),
    ["src/empty"],
  );
  for (const directory of [
    "../outside",
    "/tmp/a",
    "README.md",
    "README.md/nested",
    "a//b",
    "node_modules/x",
  ])
    assert.throws(() => validWorkspaceDirectories([directory], files));
});

test("discovers empty folders, terminal files, edits, renames and deletions", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cs-explorer-"));
  try {
    await fs.mkdir(path.join(root, "new_folder/nested"), { recursive: true });
    await fs.writeFile(
      path.join(root, "new_folder/hello.txt"),
      "hello from Bash\n",
    );
    let snapshot = await workspaceFiles(root);
    assert.equal(snapshot.complete, true);
    assert.deepEqual(snapshot.directories, ["new_folder", "new_folder/nested"]);
    assert.deepEqual(snapshot.files, [
      { path: "new_folder/hello.txt", content: "hello from Bash\n" },
    ]);
    const before = fileHashes(snapshot.files);
    await fs.writeFile(path.join(root, "new_folder/hello.txt"), "changed\n");
    assert.notDeepEqual(fileHashes((await workspaceFiles(root)).files), before);
    await fs.rename(
      path.join(root, "new_folder/hello.txt"),
      path.join(root, "renamed.txt"),
    );
    assert.deepEqual(
      (await workspaceFiles(root)).files.map((f) => f.path),
      ["renamed.txt"],
    );
    await fs.rm(path.join(root, "renamed.txt"));
    snapshot = await workspaceFiles(root);
    assert.deepEqual(snapshot.files, []);
    assert.ok(snapshot.directories.includes("new_folder/nested"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("skips generated trees and refuses symlinks, binary and oversized files", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "cs-explorer-safe-"));
  const root = path.join(parent, "work");
  try {
    await fs.mkdir(root);
    for (const directory of [
      "node_modules",
      ".git",
      "backend/target",
      "frontend/.next",
    ]) {
      await fs.mkdir(path.join(root, directory), { recursive: true });
      await fs.writeFile(path.join(root, directory, "ignored"), "generated");
    }
    await fs.writeFile(path.join(parent, "outside.txt"), "private");
    await fs.symlink(parent, path.join(root, "link-directory"));
    await fs.symlink(
      path.join(parent, "outside.txt"),
      path.join(root, "link.txt"),
    );
    await fs.writeFile(path.join(root, "large.txt"), "x".repeat(200001));
    await fs.writeFile(path.join(root, "binary"), Buffer.from([0, 1, 2]));
    await fs.writeFile(path.join(root, "valid.js"), "console.log('ok')");
    const snapshot = await workspaceFiles(root);
    assert.equal(snapshot.complete, false);
    assert.deepEqual(
      snapshot.files.map((f) => f.path),
      ["valid.js"],
    );
    assert.deepEqual(snapshot.directories, ["backend", "frontend"]);
    assert.ok(!JSON.stringify(snapshot).includes("private"));
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});
