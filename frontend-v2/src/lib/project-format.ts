import type { CursorOptions, Plugin } from "prettier";

// Prettier's browser builds expose named exports; Node/Jest may wrap their
// CommonJS builds in a default export instead.
const plugin = (module: Plugin & { default?: Plugin }): Plugin =>
  module.default || module;

export function projectFormatter(path: string): string | null {
  const name = path.split("/").pop()?.toLowerCase() || "";
  if ([".prettierrc", ".babelrc", ".eslintrc"].includes(name)) return "json";
  const extension = name.split(".").pop() || "";
  return (
    (
      {
        js: "babel",
        jsx: "babel",
        mjs: "babel",
        cjs: "babel",
        ts: "typescript",
        tsx: "typescript",
        mts: "typescript",
        cts: "typescript",
        json: "json-stringify",
        jsonc: "json",
        css: "css",
        scss: "scss",
        less: "less",
        html: "html",
        htm: "html",
        vue: "vue",
        svelte: "svelte",
        md: "markdown",
        mdx: "mdx",
        yaml: "yaml",
        yml: "yaml",
        xml: "xml",
        java: "java",
      } as Record<string, string>
    )[extension] || null
  );
}

async function pluginsFor(parser: string): Promise<Plugin[]> {
  if (["babel", "json", "json-stringify"].includes(parser))
    return Promise.all([
      import("prettier/plugins/babel").then(plugin),
      import("prettier/plugins/estree").then(plugin),
    ]);
  if (parser === "typescript")
    return Promise.all([
      import("prettier/plugins/typescript").then(plugin),
      import("prettier/plugins/estree").then(plugin),
    ]);
  if (["css", "scss", "less"].includes(parser))
    return [plugin(await import("prettier/plugins/postcss"))];
  if (parser === "yaml") return [plugin(await import("prettier/plugins/yaml"))];
  if (parser === "xml") return [plugin(await import("@prettier/plugin-xml"))];
  if (parser === "java") return [plugin(await import("prettier-plugin-java"))];
  const embedded: Plugin[] = await Promise.all([
    import("prettier/plugins/babel").then(plugin),
    import("prettier/plugins/estree").then(plugin),
    import("prettier/plugins/typescript").then(plugin),
    import("prettier/plugins/postcss").then(plugin),
    import("prettier/plugins/html").then(plugin),
  ]);
  if (["markdown", "mdx"].includes(parser))
    embedded.push(plugin(await import("prettier/plugins/markdown")));
  if (parser === "svelte")
    embedded.push(plugin(await import("prettier-plugin-svelte/browser")));
  return embedded;
}

export async function formatProjectCode(
  path: string,
  source: string,
  cursorOffset = 0,
) {
  const parser = projectFormatter(path);
  if (!parser)
    throw new Error("Formatting is not available for this file type.");
  const [prettier, plugins] = await Promise.all([
    import("prettier/standalone"),
    pluginsFor(parser),
  ]);
  const options: CursorOptions = {
    parser,
    plugins,
    filepath: path,
    cursorOffset,
    tabWidth: parser === "java" ? 4 : 2,
    useTabs: false,
    printWidth: 88,
    semi: true,
    singleQuote: true,
    endOfLine: "lf",
    ...(parser === "xml" ? { xmlWhitespaceSensitivity: "ignore" } : {}),
  };
  // This Java parser's CST does not support Prettier's cursor-node traversal.
  // Keep the cursor near the same source token without asking it to traverse CST nodes.
  if (parser === "java") {
    const formatted = await prettier.format(source, options);
    const tokensBefore = source
      .slice(0, cursorOffset)
      .replace(/\s/g, "").length;
    let cursor = 0,
      tokens = 0;
    while (cursor < formatted.length && tokens < tokensBefore) {
      if (!/\s/.test(formatted[cursor])) tokens++;
      cursor++;
    }
    return { formatted, cursorOffset: cursor };
  }
  return prettier.formatWithCursor(source, options);
}
