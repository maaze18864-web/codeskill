import { formatIndianDateTime } from "@/lib/indian-time";

export const RESULT_NOT_AVAILABLE = "Not available";
export type ResultsExportView = "candidates" | "all_attempts";

type ScoreRecord = { attemptNumber?: unknown; score?: unknown };
export type AssessmentExportAttempt = {
  studentUid?: unknown; studentName?: unknown; studentEmail?: unknown;
  totalAttempts?: unknown; attemptNumber?: unknown; allAttempts?: ScoreRecord[];
  score?: unknown; rawScore?: unknown; proctoringPenalty?: unknown; maxScore?: unknown;
  percentage?: unknown; passed?: unknown; status?: unknown;
  totalAttempted?: unknown; totalCorrect?: unknown; totalWrong?: unknown;
  totalSkipped?: unknown; accuracy?: unknown; timeSpentSeconds?: unknown;
  tabSwitchCount?: unknown; violations?: unknown[]; violationsCount?: unknown;
  startedAt?: unknown; submittedAt?: unknown;
};
type Assessment = { title?: unknown; code?: unknown; totalMarks?: unknown };
type Cell = string | number;

export function resultText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return RESULT_NOT_AVAILABLE;
  const text = String(value).trim();
  return !text || /^(unknown|undefined|null|n\/a)$/i.test(text) ? RESULT_NOT_AVAILABLE : text;
}
function numeric(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return;
  if (typeof value === "string" && !value.trim()) return;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function numberCell(value: unknown): Cell { return numeric(value) ?? RESULT_NOT_AVAILABLE; }

function result(attempt: AssessmentExportAttempt): string {
  if (attempt.status === "in_progress") return "In progress";
  if (attempt.status === "evaluating") return "Evaluating";
  if (attempt.status === "disqualified") return "Disqualified";
  if (attempt.status === "timed_out") return "Timed out";
  return typeof attempt.passed === "boolean" ? attempt.passed ? "PASSED" : "FAILED" : RESULT_NOT_AVAILABLE;
}
function csvCell(value: Cell): string {
  // Quote every cell and keep spreadsheet software from treating user text as a formula.
  const text = typeof value === "number" ? String(value) : /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Only formats the authoritative result payload; it does not change grading. */
export function assessmentResultsCSV(assessment: Assessment, attempts: AssessmentExportAttempt[], view: ResultsExportView): string {
  const summary = view === "candidates";
  const headers = ["Assessment", "Assessment Code", "Student UID", "Student Name", "Email",
    summary ? "Total Attempts" : "Attempt Number", summary ? "Best Score" : "Score",
    ...(summary ? ["All Scores Breakdown"] : []), "Raw Score", "Proctoring Penalty", "Max Score", "Percentage (%)",
    "Attempt Status", "Result", "Total Attempted", "Total Correct", "Total Wrong", "Total Skipped", "Accuracy (%)",
    "Time Spent (sec)", "Tab Switches", "Total Violations", "Started At (IST)", "Submitted At (IST)"];
  const rows: Cell[][] = attempts.map(attempt => {
    const score = numeric(attempt.score);
    const max = numeric(attempt.maxScore) ?? numeric(assessment.totalMarks);
    const percentage = numeric(attempt.percentage) ?? (score !== undefined && max !== undefined && max > 0 ? Math.round(score / max * 10000) / 100 : undefined);
    const history = attempt.allAttempts?.length ? attempt.allAttempts.map((item, index) => `#${numeric(item.attemptNumber) ?? index + 1}: ${numberCell(item.score)} pts`).join(" | ") : `#${numeric(attempt.attemptNumber) ?? 1}: ${numberCell(attempt.score)} pts`;
    return [resultText(assessment.title), resultText(assessment.code), resultText(attempt.studentUid), resultText(attempt.studentName), resultText(attempt.studentEmail),
      summary ? numeric(attempt.totalAttempts) ?? (attempt.allAttempts?.length || 1) : numberCell(attempt.attemptNumber),
      numberCell(score), ...(summary ? [history] : []), numberCell(attempt.rawScore), numberCell(attempt.proctoringPenalty), numberCell(max), numberCell(percentage),
      resultText(attempt.status), result(attempt), numberCell(attempt.totalAttempted), numberCell(attempt.totalCorrect), numberCell(attempt.totalWrong), numberCell(attempt.totalSkipped), numberCell(attempt.accuracy),
      numberCell(attempt.timeSpentSeconds), numberCell(attempt.tabSwitchCount), Array.isArray(attempt.violations) ? attempt.violations.length : numberCell(attempt.violationsCount), formatIndianDateTime(attempt.startedAt), formatIndianDateTime(attempt.submittedAt)];
  });
  // BOM helps Excel/WPS detect UTF-8; CRLF and escaped cells preserve multiline and comma-containing data.
  return "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
