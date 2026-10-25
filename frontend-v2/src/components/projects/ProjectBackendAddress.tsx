"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function ProjectBackendAddress({
  url,
  healthPath = "health",
  frontendStack,
}: {
  url: string | null;
  healthPath?: string;
  frontendStack?: string | null;
}) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setError("");
    } catch {
      setError("Select the backend URL and copy it manually.");
    }
  }
  return (
    <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
          Backend
        </span>
        <input
          aria-label="Backend URL"
          title={url || undefined}
          value={url || "Run the project to get its backend URL"}
          readOnly
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!url}
          aria-label="Copy backend URL"
          title={copied === url ? "Copied" : "Copy backend URL"}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {url && copied === url ? (
            <Check className="size-3.5 text-primary" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
        {url && (
          <a
            href={new URL(healthPath, url).href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              healthPath === "health"
                ? "Open backend health check"
                : "Open backend API example"
            }
            title={
              healthPath === "health"
                ? "Test backend: /health"
                : `Test API: /${healthPath}`
            }
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
        Append your API route to this URL. <code>localhost:3001</code> is
        available only inside the project terminal.
      </p>
      {frontendStack && (
        <details className="mt-1 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">Call from frontend</summary>
          <code className="mt-1 block break-words rounded bg-muted/50 p-2">
            {frontendStack === "nextjs"
              ? "fetch(process.env.NEXT_PUBLIC_PROJECT_BASE + 'api/tasks')"
              : "fetch(import.meta.env.BASE_URL + 'api/tasks')"}
          </code>
          <p className="mt-1">
            Replace <code>api/tasks</code> with your route. This
            project-relative form keeps working after a runtime restart.
          </p>
        </details>
      )}
      {error && (
        <p role="status" className="mt-1 text-[10px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
