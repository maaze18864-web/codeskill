import {
  createProjectEntry,
  deleteProjectEntry,
  moveProjectEntry,
  projectSnapshot,
  remapProjectPath,
  mergeProjectDirectories,
} from "./project-explorer";
const document = {
  files: [
    { path: "README.md", content: "# Demo" },
    { path: "src/components/App.jsx", content: "export default 1;" },
  ],
  directories: ["src/components", "src/empty", "assets"],
};
describe("Project explorer operations", () => {
  it("creates nested empty folders and files with durable directory snapshots", () => {
    let next = createProjectEntry(document, "src/new/nested", true);
    expect(next.directories).toContain("src/new/nested");
    next = createProjectEntry(next, "src/new/nested/file.js", false);
    expect(next.files.at(-1)).toEqual({
      path: "src/new/nested/file.js",
      content: "",
    });
    expect(
      JSON.parse(projectSnapshot(next.files, next.directories)).directories,
    ).toContain("src/new/nested");
  });
  it("moves a folder with its source contents and empty descendants intact", () => {
    const next = moveProjectEntry(document, "src", "assets/src");
    expect(next.files[1]).toEqual({
      path: "assets/src/components/App.jsx",
      content: "export default 1;",
    });
    expect(next.directories).toContain("assets/src/empty");
    expect(next.directories).not.toContain("src");
    expect(
      remapProjectPath("src/components/App.jsx", "src", "assets/src"),
    ).toBe("assets/src/components/App.jsx");
    expect(remapProjectPath("src-other.js", "src", "assets/src")).toBe(
      "src-other.js",
    );
  });
  it("moves files out to the project root and preserves the old empty parent", () => {
    const next = moveProjectEntry(
      document,
      "src/components/App.jsx",
      "App.jsx",
    );
    expect(next.files[1].path).toBe("App.jsx");
    expect(next.directories).toContain("src/components");
  });
  it("deletes an entire folder subtree while preserving unrelated files", () => {
    const next = deleteProjectEntry(document, "src");
    expect(next.files).toEqual([document.files[0]]);
    expect(next.directories).toEqual(["assets"]);
    expect(deleteProjectEntry(document, "src/empty").directories).not.toContain(
      "src/empty",
    );
  });
  it("rejects overwrites, traversal, self-descendant moves and deleting the last file", () => {
    for (const [from, to] of [
      ["src", "src/nested/src"],
      ["src", "assets"],
      ["README.md", "../outside"],
      ["README.md", "src/components/App.jsx"],
      ["src", "README.md/nested"],
    ])
      expect(() => moveProjectEntry(document, from, to)).toThrow();
    expect(() => createProjectEntry(document, "src", false)).toThrow();
    expect(() =>
      createProjectEntry(document, "README.md/child", true),
    ).toThrow();
    expect(() =>
      deleteProjectEntry(
        { files: [document.files[0]], directories: [] },
        "README.md",
      ),
    ).toThrow("1–100");
    expect(moveProjectEntry(document, "src", "src")).toBe(document);
  });
  it("merges terminal folder changes without resurrecting local deletions", () => {
    expect(
      mergeProjectDirectories(["local"], ["old"], ["old", "terminal"], true),
    ).toEqual(["local", "terminal"]);
    expect(mergeProjectDirectories(["old"], ["old"], [], false)).toEqual([
      "old",
    ]);
    expect(mergeProjectDirectories(["old"], ["old"], [], true)).toEqual([]);
  });
});
