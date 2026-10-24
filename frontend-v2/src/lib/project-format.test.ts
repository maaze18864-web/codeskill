/** @jest-environment node */
import { formatProjectCode, projectFormatter } from "./project-format";

describe("Project source formatting", () => {
  it("formats React JSX with consistent indentation and preserves the cursor", async () => {
    const source =
      "function App(){return <main><h1>Hello</h1><p>World</p></main>}";
    const cursorOffset = source.indexOf("Hello") + 2;
    const result = await formatProjectCode(
      "frontend/src/App.jsx",
      source,
      cursorOffset,
    );
    expect(result.formatted).toContain(
      "function App() {\n  return (\n    <main>\n      <h1>Hello</h1>",
    );
    expect(
      result.formatted.slice(result.cursorOffset - 2, result.cursorOffset + 3),
    ).toBe("Hello");
    expect(
      (await formatProjectCode("App.jsx", result.formatted)).formatted,
    ).toBe(result.formatted);
  });
  test.each([
    [
      "main.tsx",
      "const App=({name}:{name:string})=><p>{name}</p>",
      "const App = ({ name }: { name: string }) => <p>{name}</p>;\n",
    ],
    [
      "package.json",
      '{"name":"demo","scripts":{"dev":"vite"}}',
      '{\n  "name": "demo",\n  "scripts": {\n    "dev": "vite"\n  }\n}\n',
    ],
    [
      "style.css",
      "main{color:red;padding:12px}",
      "main {\n  color: red;\n  padding: 12px;\n}\n",
    ],
    [
      "config.yml",
      "app:\n name: demo\n enabled: true",
      "app:\n  name: demo\n  enabled: true\n",
    ],
  ])("formats %s", async (path, source, expected) => {
    expect((await formatProjectCode(path, source)).formatted).toBe(expected);
  });
  it("formats embedded JavaScript and CSS in HTML and Vue", async () => {
    const source =
      "<template><div><p>Hello</p><p>World</p></div></template><script>const x={a:1,b:2}</script><style>p{color:red}</style>";
    const { formatted } = await formatProjectCode("App.vue", source);
    expect(formatted).toContain(
      "<div>\n    <p>Hello</p>\n    <p>World</p>\n  </div>",
    );
    expect(formatted).toContain("const x = { a: 1, b: 2 };");
    expect(formatted).toContain("p {\n  color: red;\n}");
  });
  it("rejects malformed syntax without manufacturing a partial result", async () => {
    await expect(formatProjectCode("main.js", "const = ;")).rejects.toThrow();
    await expect(
      formatProjectCode("main.py", "print('hello')"),
    ).rejects.toThrow("not available");
  });
  it("identifies configuration and stack-specific files without parsing unrelated text", () => {
    expect(projectFormatter("frontend/.prettierrc")).toBe("json");
    expect(projectFormatter("frontend/App.svelte")).toBe("svelte");
    expect(projectFormatter("backend/Application.java")).toBe("java");
    expect(projectFormatter("backend/pom.xml")).toBe("xml");
    expect(projectFormatter("backend/application.properties")).toBeNull();
    expect(projectFormatter(".env")).toBeNull();
  });
});
