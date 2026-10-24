"use client";
import { useState } from "react";
import type { SqlProblemInput, SqlTable } from "@/lib/sql-workspace";
import {
  LabsModal,
  labsControl,
  labsAction,
  labsPrimary,
  labsError,
} from "./LabsUI";
export function LabSqlAuthor({
  initial,
  maxScore = 10,
  onClose,
  onSave,
}: {
  initial?: SqlProblemInput;
  maxScore?: number;
  onClose: () => void;
  onSave: (data: {
    problem: SqlProblemInput;
    maxScore: number;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SqlProblemInput>(
    initial || {
      title: "",
      description: "",
      schemaSql: "CREATE TABLE students (id INTEGER, name TEXT);",
      starterCode: "-- Write your SELECT query here\n",
      orderMatters: true,
      datasets: [
        {
          seedSql: "INSERT INTO students VALUES (1, 'Ada');",
          isHidden: false,
          expected: { columns: ["name"], rows: [["Ada"]] },
        },
      ],
    },
  );
  const [expected, setExpected] = useState(
      (initial?.datasets || draft.datasets).map((dataset) =>
        JSON.stringify(dataset.expected, null, 2),
      ),
    ),
    [marks, setMarks] = useState(maxScore),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <LabsModal
      open
      onClose={onClose}
      busy={busy}
      wide
      title={
        initial ? "Edit SQL practice question" : "Add SQL practice question"
      }
      description="Students use a SQL editor and result tables. Only the schema and public example datasets are visible to them."
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const datasets = draft.datasets.map((dataset, index) => ({
              ...dataset,
              expected: JSON.parse(expected[index]) as SqlTable,
            }));
            await onSave({ problem: { ...draft, datasets }, maxScore: marks });
          } catch (error) {
            setError(
              labsError(
                error,
                error instanceof Error
                  ? error.message
                  : "Could not save SQL question.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="text-xs font-medium">
            Question title
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={`${labsControl} mt-2 w-full`}
            />
          </label>
          <label className="text-xs font-medium">
            Practice marks
            <input
              type="number"
              min={0}
              max={10000}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className={`${labsControl} mt-2 w-full`}
            />
          </label>
        </div>
        <label className="block text-xs font-medium">
          Instructions
          <textarea
            required
            rows={4}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            className={`${labsControl} mt-2 h-auto w-full py-2`}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["schemaSql", "starterCode"] as const).map((key) => (
            <label key={key} className="text-xs font-medium">
              {key === "schemaSql" ? "Public database schema" : "Starter SQL"}
              <textarea
                required
                rows={7}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className={`${labsControl} mt-2 h-auto w-full py-2 font-mono text-xs`}
              />
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.orderMatters}
            onChange={(e) =>
              setDraft({ ...draft, orderMatters: e.target.checked })
            }
          />
          Result row order must match
        </label>
        <h3 className="text-sm font-semibold">Test datasets</h3>
        <p className="text-xs text-muted-foreground">
          Expected result: JSON with columns and rows. At least one dataset must
          be public. Hidden seeds and results stay on the server.
        </p>
        {draft.datasets.map((dataset, index) => (
          <fieldset
            key={index}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <legend className="px-1 text-xs font-semibold">
              Dataset {index + 1}
            </legend>
            <div className="flex justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={dataset.isHidden}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      datasets: draft.datasets.map((item, i) =>
                        i === index
                          ? { ...item, isHidden: e.target.checked }
                          : item,
                      ),
                    })
                  }
                />
                Hidden
              </label>
              <button
                type="button"
                className="text-xs text-destructive"
                disabled={draft.datasets.length === 1}
                onClick={() => {
                  setDraft({
                    ...draft,
                    datasets: draft.datasets.filter((_, i) => i !== index),
                  });
                  setExpected(expected.filter((_, i) => i !== index));
                }}
              >
                Remove dataset
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                Seed SQL
                <textarea
                  rows={6}
                  value={dataset.seedSql}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      datasets: draft.datasets.map((item, i) =>
                        i === index
                          ? { ...item, seedSql: e.target.value }
                          : item,
                      ),
                    })
                  }
                  className={`${labsControl} mt-2 h-auto w-full py-2 font-mono text-xs`}
                />
              </label>
              <label className="text-xs">
                Expected table JSON
                <textarea
                  rows={6}
                  value={expected[index]}
                  onChange={(e) =>
                    setExpected(
                      expected.map((item, i) =>
                        i === index ? e.target.value : item,
                      ),
                    )
                  }
                  className={`${labsControl} mt-2 h-auto w-full py-2 font-mono text-xs`}
                />
              </label>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={draft.datasets.length >= 8}
          className={labsAction}
          onClick={() => {
            setDraft({
              ...draft,
              datasets: [
                ...draft.datasets,
                {
                  seedSql: "",
                  isHidden: true,
                  expected: { columns: ["result"], rows: [] },
                },
              ],
            });
            setExpected([...expected, '{"columns":["result"],"rows":[]}']);
          }}
        >
          Add dataset
        </button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={labsAction}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className={labsPrimary} disabled={busy}>
            {busy ? "Saving…" : "Save SQL question"}
          </button>
        </div>
      </form>
    </LabsModal>
  );
}
export function LabMarksEditor({
  value,
  onSave,
  label,
}: {
  value: number;
  label: string;
  onSave: (marks: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(value)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          aria-label={label}
          type="number"
          min={0}
          max={10000}
          step="0.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`${labsControl} h-8 w-20 text-xs`}
        />
        <button
          disabled={busy || draft === "" || Number(draft) === value}
          className="text-xs font-medium text-primary disabled:opacity-40"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onSave(Number(draft));
            } catch (error) {
              setError(labsError(error, "Could not update marks."));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[10px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
