"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Send,
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { labsAction, labsPrimary, labsError } from "@/components/labs/LabsUI";
import type {
  SqlPublicProblem,
  SqlFeedback,
  SqlTable,
} from "@/lib/sql-workspace";
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
export function SqlResultTable({ columns, rows }: SqlTable) {
  return (
    <div className="max-h-48 overflow-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="whitespace-nowrap px-3 py-2 font-semibold"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {row.map((cell, i) => (
                <td key={i} className="max-w-64 truncate px-3 py-2 font-mono">
                  {cell === null ? (
                    <span className="text-muted-foreground">NULL</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-3 text-xs text-muted-foreground">No rows returned</p>
      )}
    </div>
  );
}
export function SqlQuestionEditor({
  problem,
  initialCode,
  marks,
  onDraftChange,
  execute,
  onVerified,
  blockCopyPaste = false,
}: {
  problem: SqlPublicProblem;
  initialCode?: string;
  marks: number;
  onDraftChange?: (code: string) => void;
  execute: (code: string, submit: boolean) => Promise<SqlFeedback>;
  onVerified?: (code: string, result: SqlFeedback) => Promise<void> | void;
  blockCopyPaste?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [code, setCode] = useState(initialCode ?? problem.starterCode),
    [busy, setBusy] = useState<"run" | "submit" | null>(null),
    [result, setResult] = useState<SqlFeedback | null>(null),
    [error, setError] = useState("");
  const alive = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(submit: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(submit ? "submit" : "run");
    setError("");
    try {
      const data = await execute(code, submit);
      if (!alive.current) return;
      setResult(data);
      if (submit) await onVerified?.(code, data);
    } catch (error) {
      if (alive.current)
        setError(labsError(error, "SQL execution could not be completed."));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(null);
    }
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto rounded-xl border border-border bg-card lg:grid-cols-[minmax(240px,35%)_minmax(0,1fr)] lg:overflow-hidden">
      <section
        aria-label="SQL problem and database schema"
        className="space-y-5 overflow-auto border-r border-border p-5"
      >
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Database className="size-3.5" />
            SQLite · {marks} marks
          </p>
          <h2 className="mt-2 text-lg font-semibold">{problem.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            {problem.description}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold">Database schema</h3>
          <pre className="overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-6">
            {problem.schemaSql}
          </pre>
        </div>
        {problem.samples.map((sample, index) => (
          <div key={index} className="space-y-2">
            <h3 className="text-xs font-semibold">Example {index + 1}</h3>
            <pre className="overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] leading-5">
              {sample.seedSql}
            </pre>
            <SqlResultTable {...sample.expected} />
          </div>
        ))}
        <p className="text-[11px] leading-5 text-muted-foreground">
          Submit one SELECT or WITH query. Each dataset starts with a fresh
          database.{" "}
          {problem.orderMatters
            ? "Result row order matters."
            : "Result row order does not matter."}
        </p>
      </section>
      <section className="flex min-h-[500px] min-w-0 flex-col lg:min-h-0">
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <span className="text-xs font-semibold">query.sql</span>
          <div className="flex gap-2">
            <button
              className={labsAction}
              disabled={!!busy}
              onClick={() => run(false)}
            >
              {busy === "run" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run
            </button>
            <button
              className={labsPrimary}
              disabled={!!busy}
              onClick={() => run(true)}
            >
              {busy === "submit" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Submit solution
            </button>
          </div>
        </div>
        <div
          className="min-h-52 flex-1"
          onCopy={(event) => {
            if (blockCopyPaste) event.preventDefault();
          }}
          onPaste={(event) => {
            if (blockCopyPaste) event.preventDefault();
          }}
        >
          <Editor
            path={`${problem.title}/query.sql`}
            height="100%"
            language="sql"
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            value={code}
            onChange={(value) => {
              setCode(value || "");
              onDraftChange?.(value || "");
            }}
            options={{
              readOnly: !!busy,
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: "on",
              padding: { top: 16 },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        <div
          aria-live="polite"
          className="max-h-[42%] min-h-32 shrink-0 space-y-3 overflow-auto border-t border-border p-4"
        >
          <h3 className="text-xs font-semibold">Results</h3>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {!result && !busy && (
            <p className="text-xs text-muted-foreground">
              Run examples to inspect rows, then submit against all datasets.
            </p>
          )}
          {busy && (
            <p className="text-xs text-muted-foreground">Executing query…</p>
          )}
          {result && (
            <>
              <p className="text-sm font-semibold">
                {result.passedCount} / {result.totalCount} datasets passed
                {result.awardedScore !== undefined
                  ? ` · ${result.awardedScore} / ${result.maxScore} marks`
                  : ""}
              </p>
              {result.results.map((item) => (
                <div key={item.id} className="space-y-2">
                  <p
                    className={`flex items-center gap-2 text-xs ${item.passed ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {item.passed ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    {item.isHidden ? "Hidden dataset" : "Example dataset"}{" "}
                    {item.id}: {item.passed ? "Passed" : "Failed"}
                  </p>
                  {!item.isHidden && item.error && (
                    <p className="text-xs text-destructive">{item.error}</p>
                  )}
                  {!item.isHidden && item.columns && item.rows && (
                    <SqlResultTable columns={item.columns} rows={item.rows} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
