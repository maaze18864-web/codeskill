"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ProjectConsoleEntry } from "@/hooks/useProjectConsole";

function summary(text: string) {
  try {
    const object = JSON.parse(text);
    if (object?.type === "Response")
      return `Response { status: ${object.status}, ok: ${object.ok} }`;
    if (Array.isArray(object)) return `Array(${object.length})`;
    if (object && typeof object === "object")
      return `Object { ${Object.keys(object).slice(0, 4).join(", ")}${Object.keys(object).length > 4 ? ", …" : ""} }`;
  } catch {
    /* Multi-argument logs and error stacks are ordinary text. */
  }
  return text.split("\n")[0];
}

export function ProjectBrowserConsole({
  entries,
  onClear,
  ready,
}: {
  entries: ProjectConsoleEntry[];
  onClear: () => void;
  ready: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("all");
  const output = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const visible = entries.filter(
    (entry) =>
      (level === "all" || entry.level === level) &&
      entry.text.toLowerCase().includes(filter.toLowerCase()),
  );
  useEffect(() => {
    if (follow.current && output.current)
      output.current.scrollTop = output.current.scrollHeight;
  }, [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <input
          aria-label="Filter console output"
          placeholder="Filter console output"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
        />
        <select
          aria-label="Console level"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="rounded border border-border bg-background px-1 py-1 text-[11px]"
        >
          <option value="all">All levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
          <option value="log">Logs</option>
          <option value="debug">Debug</option>
        </select>
        <button
          onClick={onClear}
          aria-label="Clear console"
          title="Clear console"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div
        ref={output}
        role="log"
        aria-label="Project browser console"
        className="min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-5"
        onScroll={() => {
          const element = output.current;
          if (element)
            follow.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              40;
        }}
      >
        {visible.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-start gap-3 border-b border-border/40 px-3 py-1 ${entry.level === "error" ? "bg-destructive/5 text-destructive" : entry.level === "warn" ? "bg-amber-500/5 text-amber-700 dark:text-amber-400" : "text-foreground"}`}
          >
            <time className="shrink-0 text-[10px] text-muted-foreground">
              {new Date(entry.time).toLocaleTimeString([], { hour12: false })}
            </time>
            <span className="w-9 shrink-0 text-[10px] uppercase opacity-70">
              {entry.level}
            </span>
            {entry.text.includes("\n") ? (
              <details className="min-w-0 flex-1">
                <summary className="cursor-pointer break-words">
                  {summary(entry.text)}
                </summary>
                <pre className="whitespace-pre-wrap break-words pt-1 font-[inherit]">
                  {entry.text}
                </pre>
              </details>
            ) : (
              <pre className="min-w-0 whitespace-pre-wrap break-words font-[inherit]">
                {entry.text}
              </pre>
            )}
          </div>
        ))}
        {!visible.length && (
          <p className="px-4 py-3 font-sans text-xs text-muted-foreground">
            {!ready
              ? "Run the project to see browser console output."
              : entries.length
                ? "No messages match your filters."
                : "console.log(), warnings, and browser errors appear here. Use or refresh the preview to debug your app."}
          </p>
        )}
      </div>
      <div className="shrink-0 border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
        Browser console · {visible.length} of {entries.length} messages · Latest
        200 retained
      </div>
    </div>
  );
}
