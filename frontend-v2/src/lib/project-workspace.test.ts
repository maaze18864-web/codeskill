import {
  formatProjectBody,
  projectLanguage,
  projectPreviewLogs,
  projectBackendUrl,
  validProjectPath,
} from "./project-workspace";
describe("Project editor", () => {
  it("uses the canonical backend endpoint and handles old fullstack controllers", () => {
    const previewUrl = "http://localhost:5083/p/test/";
    const runtime = { state: "ready" as const, previewUrl, logs: [] };
    expect(
      projectBackendUrl(
        { frontendStack: "react", backendStack: "express" },
        runtime,
      ),
    ).toBe(`${previewUrl}__backend/`);
    expect(
      projectBackendUrl(
        { frontendStack: "nextjs", backendStack: null },
        runtime,
      ),
    ).toBe(previewUrl);
    expect(
      projectBackendUrl(
        { frontendStack: null, backendStack: "springboot" },
        { ...runtime, previewUrl: null, backendUrl: `${previewUrl}__backend/` },
      ),
    ).toBe(`${previewUrl}__backend/`);
    expect(
      projectBackendUrl(
        { frontendStack: "react", backendStack: null },
        runtime,
      ),
    ).toBeNull();
    expect(
      projectBackendUrl(
        { frontendStack: "react", backendStack: "express" },
        { ...runtime, state: "stopped" },
      ),
    ).toBeNull();
  });
  it("replaces backend container URLs in logs while preserving route paths", () => {
    const backendUrl = "http://localhost:5083/p/test/__backend/";
    expect(
      projectPreviewLogs({
        state: "ready",
        previewUrl: null,
        backendUrl,
        logs: [
          "Listening on http://localhost:3001",
          "GET http://127.0.0.1:3001/api/tasks",
          "http://localhost:30010",
        ],
      }),
    ).toEqual([
      `Listening on ${backendUrl}`,
      `GET ${backendUrl}api/tasks`,
      "http://localhost:30010",
    ]);
  });
  it("shows the browser preview address instead of the container listener in logs", () => {
    const scope = `/p/${"a".repeat(48)}/`;
    const previewUrl = `https://preview.example.com${scope}`;
    const logs = [
      ...["127.0.0.1", "localhost", "[::1]"].map(
        (host) => `  ➜  Local: http://${host}:4173${scope}`,
      ),
      "[INFO] BUILD SUCCESS",
      "Backend listening on http://127.0.0.1:3001",
    ];
    const formatted = projectPreviewLogs({ state: "ready", previewUrl, logs });
    expect(formatted.slice(0, 3)).toEqual(
      Array(3).fill(`  ➜  Local: ${previewUrl}`),
    );
    expect(formatted.slice(3)).toEqual(logs.slice(3));
    expect(logs[0]).toContain(":4173");
  });
  it("preserves diagnostics when there is no running preview", () => {
    const logs = ["Frontend did not start"];
    expect(
      projectPreviewLogs({ state: "failed", previewUrl: null, logs }),
    ).toEqual(logs);
  });
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
