// Exercise the browser formatter's ESM-only plugins outside Jest's CJS loader.
// No running application, Docker, credentials, or database is required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const appRequire = createRequire(
  new URL("../../frontend-v2/package.json", import.meta.url),
);
const ts = appRequire("typescript");
const source = await readFile(
  new URL("../../frontend-v2/src/lib/project-format.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const resolved = compiled.replace(
  /import\("([^"]+)"\)/g,
  (_match, name) =>
    `import(${JSON.stringify(pathToFileURL(appRequire.resolve(name === "prettier/standalone" ? "prettier/standalone.mjs" : name)).href)})`,
);
const { formatProjectCode } = await import(
  `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`
);
for (const [path, code, expected] of [
  [
    "Application.java",
    'public class Application { public static void main(String[] args){ System.out.println("Hello"); } }',
    '    public static void main(String[] args) {\n        System.out.println("Hello");',
  ],
  [
    "pom.xml",
    "<project><modelVersion>4.0.0</modelVersion><name>Demo</name></project>",
    "<project>\n  <modelVersion>4.0.0</modelVersion>\n  <name>Demo</name>\n</project>",
  ],
  [
    "App.svelte",
    "<script>let count=0;</script><button onclick={()=>count++}>{count}</button>",
    "<script>\n  let count = 0;\n</script>",
  ],
]) {
  const { formatted } = await formatProjectCode(path, code);
  assert.ok(formatted.includes(expected), `${path}: expected indented source`);
  assert.equal(
    (await formatProjectCode(path, formatted)).formatted,
    formatted,
    `${path}: formatting must be idempotent`,
  );
  console.log(`${path}: formatting and idempotence passed`);
}
