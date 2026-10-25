import { gzipSync, gunzipSync } from "node:zlib";

// Runs in the student preview, never in the application origin. Keep this
// function self-contained so it can be served as a plain browser script.
function connectConsole(parentOrigins) {
  if (window.parent === window || window.__codeskillConsoleConnected) return;
  window.__codeskillConsoleConnected = true;
  let started = Date.now(),
    count = 0;
  const format = (value) => {
    const seen = new WeakSet();
    const snapshot = (item, depth = 0) => {
      if (typeof item === "string") return item.slice(0, 4000);
      if (
        item === null ||
        typeof item === "number" ||
        typeof item === "boolean"
      )
        return item;
      if (typeof item !== "object") return String(item);
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
      if (item instanceof Error)
        return item.stack || `${item.name}: ${item.message}`;
      if (item instanceof Response)
        return {
          type: "Response",
          url: item.url,
          status: item.status,
          statusText: item.statusText,
          ok: item.ok,
          redirected: item.redirected,
          headers: Object.fromEntries(item.headers),
          bodyUsed: item.bodyUsed,
        };
      if (item instanceof Date) return item.toISOString();
      if (depth >= 3) return Array.isArray(item) ? "[Array]" : "[Object]";
      if (Array.isArray(item))
        return item.slice(0, 30).map((part) => snapshot(part, depth + 1));
      const result = {};
      for (const [key, descriptor] of Object.entries(
        Object.getOwnPropertyDescriptors(item),
      ).slice(0, 30))
        result[key] =
          "value" in descriptor
            ? snapshot(descriptor.value, depth + 1)
            : "[Getter]";
      return result;
    };
    try {
      const result = snapshot(value);
      return (
        typeof result === "string" ? result : JSON.stringify(result, null, 2)
      ).slice(0, 4000);
    } catch {
      return "[Could not inspect value]";
    }
  };
  const send = (level, values) => {
    if (Date.now() - started >= 1000) {
      started = Date.now();
      count = 0;
    }
    if (++count > 40) return;
    let remaining = 16000;
    const args = values.slice(0, 10).map((value) => {
      const text = format(value).slice(0, remaining);
      remaining -= text.length;
      return text;
    });
    for (const origin of parentOrigins) {
      try {
        window.parent.postMessage(
          { channel: "codeskill:project-console", level, args },
          origin,
        );
      } catch {
        /* Preview navigation must not break the student's application. */
      }
    }
  };
  for (const level of ["log", "info", "debug", "warn", "error", "clear"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      original(...values);
      send(level, values);
    };
  }
  window.addEventListener(
    "error",
    (event) => {
      const resource = event.target?.src || event.target?.href;
      send("error", [
        event.error ||
          event.message ||
          `Failed to load resource: ${resource || "unknown"}`,
        ...(event.filename
          ? [`${event.filename}:${event.lineno}:${event.colno}`]
          : []),
      ]);
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) =>
    send("error", ["Unhandled promise rejection:", event.reason]),
  );
}

export function previewConsoleScript(parentOrigins) {
  return `(${connectConsole.toString()})(${JSON.stringify(parentOrigins)});`;
}

export function instrumentPreviewHtml(response, scriptPath) {
  if (
    response.status !== 200 ||
    !/^text\/html\b/i.test(response.headers["content-type"] || "")
  )
    return response;
  const raw = Buffer.from(response.body, "base64");
  const html = (
    response.bridgeEncoding === "gzip" ? gunzipSync(raw) : raw
  ).toString("utf8");
  const script = `<script src="${scriptPath}"></script>`;
  // Capture early module logs/errors without editing or persisting student files.
  const modified = /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (head) => head + script)
    : html.replace(/^(\s*<!doctype[^>]*>)?/i, (doctype) => doctype + script);
  const payload = Buffer.from(modified);
  return {
    ...response,
    body: (response.bridgeEncoding === "gzip"
      ? gzipSync(payload)
      : payload
    ).toString("base64"),
  };
}
