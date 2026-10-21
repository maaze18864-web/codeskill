"use client";

import { Terminal } from "lucide-react";

/** A case is only worth showing when it carries input or expected output. */
export function hasSampleContent(tc: { input?: string; output?: string; expected?: string; expectedOutput?: string }) {
  return Boolean(
    (tc.input || "").trim() ||
      (tc.output || "").trim() ||
      (tc.expected || "").trim() ||
      (tc.expectedOutput || "").trim(),
  );
}

export interface SampleCase {
  input?: string;
  output?: string;
  explanation?: string;
}

interface SampleTestCasesPanelProps {
  samples: SampleCase[];
  /** Load the sample's input into the run console. */
  onLoad?: (sample: SampleCase, index: number) => void;
}

/**
 * Candidate-facing sample test cases. Public (non-hidden) cases only — the judge
 * keeps hidden cases for grading.
 */
export default function SampleTestCasesPanel({
  samples,
  onLoad,
}: SampleTestCasesPanelProps) {
  if (samples.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic leading-relaxed">
        No sample test cases for this problem. Read input from standard input
        (stdin) and write your answer to standard output (stdout).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {samples.map((sample, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-secondary overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 bg-muted/50 px-3.5 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Example {index + 1}
            </span>
            {onLoad && (
              <button
                type="button"
                onClick={() => onLoad(sample, index)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Terminal className="w-3 h-3" /> Load in Console
              </button>
            )}
          </div>

          <div className="p-3.5 space-y-2.5 font-mono text-xs text-foreground/80">
            <div>
              <span className="text-muted-foreground text-[10px] font-sans font-semibold uppercase">
                Input
              </span>
              <pre className="bg-card border border-border/50 rounded-lg p-2.5 mt-1 text-foreground whitespace-pre-wrap overflow-x-auto">
                {sample.input || "(no input)"}
              </pre>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] font-sans font-semibold uppercase">
                Output
              </span>
              <pre className="bg-card border border-border/50 rounded-lg p-2.5 mt-1 text-foreground whitespace-pre-wrap overflow-x-auto">
                {sample.output || "(no output)"}
              </pre>
            </div>
            {sample.explanation && (
              <div className="font-sans text-xs leading-relaxed text-foreground/80 border-t border-border/50 pt-2">
                <span className="font-semibold text-foreground">Explanation: </span>
                {sample.explanation}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
