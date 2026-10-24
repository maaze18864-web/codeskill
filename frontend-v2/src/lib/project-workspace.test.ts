import {
  formatProjectBody,
  projectLanguage,
  validProjectPath,
} from "./project-workspace";
describe("Project editor", () => {
  it("validates file operations before sending data", () => {
    const files = [{ path: "src/main.jsx", content: "" }];
    expect(validProjectPath("src/Other.jsx", files)).toBe(true);
    for (const p of [
      "../x",
      "/tmp/x",
      "src/main.jsx",
      "src",
      "src/main.jsx/child",
      "node_modules/x",
      "a//b",
    ])
      expect(validProjectPath(p, files)).toBe(false);
    expect(validProjectPath("src/main.jsx", files, "src/main.jsx")).toBe(true);
  });
  it("supports editing Python, JSX and Vue files and preserves non-JSON responses", () => {
    expect(projectLanguage("backend/main.py")).toBe("python");
    expect(projectLanguage("frontend/main.jsx")).toBe("javascript");
    expect(projectLanguage("App.vue")).toBe("html");
    expect(formatProjectBody("<h1>hello</h1>")).toBe("<h1>hello</h1>");
    expect(formatProjectBody('{"ok":true}')).toContain("\n");
  });
});
