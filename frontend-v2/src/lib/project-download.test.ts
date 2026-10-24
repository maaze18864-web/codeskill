import { unzipSync } from "fflate";
import { TextDecoder, TextEncoder } from "node:util";
import { createProjectZip } from "./project-download";
Object.assign(globalThis, { TextEncoder });
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("Project ZIP download", () => {
  it("exports every source file, nested paths and empty runtime folders", () => {
    const files = [
      {
        path: "frontend/src/App.jsx",
        content: "export default () => 'Hello 🌎';",
      },
      { path: "backend/server.js", content: "console.log('backend');" },
      { path: "package.json", content: '{"name":"demo"}' },
      { path: "README.md", content: "# Run this project\n" },
    ];
    const { bytes, filename } = createProjectZip(
      "My fullstack project",
      files,
      ["frontend", "backend", "empty"],
    );
    expect(filename).toBe("my-fullstack-project.zip");
    expect(Array.from(bytes.slice(0, 4))).toEqual([80, 75, 3, 4]);
    const unpacked = unzipSync(bytes);
    for (const file of files)
      expect(decode(unpacked[`my-fullstack-project/${file.path}`])).toBe(
        file.content,
      );
    expect(unpacked["my-fullstack-project/empty/"]).toHaveLength(0);
    expect(unpacked["my-fullstack-project/frontend/src/"]).toHaveLength(0);
    expect(unpacked["my-fullstack-project/"]).toHaveLength(0);
  });
  it("downloads the current editor contents, including unsaved and empty files", () => {
    const { bytes } = createProjectZip("Demo", [
      { path: "main.py", content: "print('unsaved draft')" },
      { path: "empty.txt", content: "" },
    ]);
    const files = unzipSync(bytes);
    expect(decode(files["demo/main.py"])).toBe("print('unsaved draft')");
    expect(files["demo/empty.txt"]).toHaveLength(0);
  });
  it("rejects unsafe archive paths and sanitizes the download filename", () => {
    for (const path of [
      "../secret",
      "/absolute",
      "a/../../bad",
      "node_modules/a",
      "a\\b",
    ])
      expect(() =>
        createProjectZip("Demo", [{ path, content: "x" }]),
      ).toThrow();
    expect(() => createProjectZip("Demo", [], ["../outside"])).toThrow();
    expect(createProjectZip("../../My:Project?", []).filename).toBe(
      "my-project.zip",
    );
    expect(createProjectZip("   ", []).filename).toBe("project.zip");
  });
});
