"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { projectsAPI } from "@/config/api";
import { labsError } from "@/components/labs/LabsUI";
import {
  formatProjectBody,
  type ProjectResponse,
} from "@/lib/project-workspace";
export function ProjectApiClient({
  id,
  ready,
}: {
  id: string;
  ready: boolean;
}) {
  const [method, setMethod] = useState("GET"),
    [path, setPath] = useState("/api/hello"),
    [headers, setHeaders] = useState('{"Content-Type": "application/json"}'),
    [body, setBody] = useState('{\n  "message": "Hello, API"\n}');
  const [tab, setTab] = useState("body"),
    [requestTab, setRequestTab] = useState("body"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<ProjectResponse | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        /[\r\n\\]/.test(path)
      )
        throw Error("Use a relative path such as /api/hello.");
      const parsed = JSON.parse(headers || "{}");
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
        throw Error("Headers must be a JSON object.");
      const { data } = await projectsAPI.request(id, {
        method,
        path,
        headers,
        body: ["GET", "HEAD"].includes(method) ? "" : body,
      });
      setResult(data);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "Headers must be valid JSON."
          : labsError(e, e instanceof Error ? e.message : "Request failed."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background">
      <form onSubmit={send} className="space-y-3 border-b border-border p-4">
        <p className="text-[11px] text-muted-foreground">
          Requests are sent to this project’s API.
        </p>
        <div className="flex gap-2">
          <select
            aria-label="HTTP method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-1 text-xs font-semibold"
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
              (m) => (
                <option key={m}>{m}</option>
              ),
            )}
          </select>
          <input
            aria-label="Request path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2 font-mono text-xs"
            placeholder="/api/hello"
          />
          <button
            disabled={!ready || busy}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-3.5" />
            {busy ? "Sending" : "Send"}
          </button>
        </div>
        <div className="flex gap-4 text-xs">
          {["body", "headers"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRequestTab(t)}
              className={`border-b-2 py-1 capitalize ${requestTab === t ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <textarea
          aria-label={
            requestTab === "body" ? "Request body" : "Request headers"
          }
          value={requestTab === "body" ? body : headers}
          onChange={(e) =>
            requestTab === "body"
              ? setBody(e.target.value)
              : setHeaders(e.target.value)
          }
          spellCheck={false}
          className="h-28 w-full resize-y rounded-md border border-border bg-card p-3 font-mono text-xs leading-5 outline-none focus:border-primary/50"
        />
      </form>
      {error && (
        <p
          role="alert"
          className="m-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {result ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-xs">
            <span
              className={
                result.status < 400
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-destructive"
              }
            >
              Status: {result.status}
            </span>
            <span className="text-muted-foreground">
              {result.durationMs} ms ·{" "}
              {new Blob([result.body]).size.toLocaleString()} B
            </span>
          </div>
          <div className="flex gap-4 px-4 text-xs">
            {["body", "headers"].map((t) => (
              <button
                className={`border-b-2 py-3 capitalize ${tab === t ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <pre
            aria-label="API response"
            className="min-h-40 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6"
          >
            {tab === "body"
              ? formatProjectBody(result.body)
              : JSON.stringify(result.headers, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-8 text-center text-xs leading-6 text-muted-foreground">
          {ready
            ? "Send a request to inspect the response here."
            : "Run your project to start testing its API."}
        </div>
      )}
    </div>
  );
}
