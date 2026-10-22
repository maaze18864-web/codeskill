import { assessmentResultsCSV, resultText, RESULT_NOT_AVAILABLE } from "@/lib/assessment-results-export";

function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  const cells = /"((?:""|[^"])*)"(,|\r\n|$)/g;
  for (const match of csv.slice(1).matchAll(cells)) {
    row.push(match[1].replace(/""/g, '"'));
    if (match[2] !== ",") { rows.push(row); row = []; }
  }
  return rows;
}
const assessment = { title: "Mixed assessment", code: "EXAM-9322", totalMarks: 110 };
const attempt = {
  studentUid: "UNKNOWN", studentName: 'Vishal, "Yadav"', studentEmail: "student@example.com",
  totalAttempts: 1, attemptNumber: 1, score: 0, rawScore: 0, proctoringPenalty: 0, maxScore: 110,
  percentage: 0, passed: false, status: "submitted", totalAttempted: 2, totalCorrect: 0,
  totalWrong: 2, totalSkipped: 1, accuracy: 0, timeSpentSeconds: 32, tabSwitchCount: 0,
  violations: [], startedAt: "2026-10-22T10:00:00Z", submittedAt: "2026-10-22T10:00:32Z",
  allAttempts: [{ attemptNumber: 1, score: 0 }],
};
it("preserves the score-history hash and fills every column through Submitted At (IST)", () => {
  const [headers, row] = parse(assessmentResultsCSV(assessment, [attempt], "candidates"));
  const values = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  expect(row).toHaveLength(headers.length);
  expect(row.every(value => value.length > 0)).toBe(true);
  expect(values["Student UID"]).toBe(RESULT_NOT_AVAILABLE);
  expect(values["Best Score"]).toBe("0");
  expect(values["All Scores Breakdown"]).toBe("#1: 0 pts");
  expect(values["Max Score"]).toBe("110");
  expect(values["Total Wrong"]).toBe("2");
  expect(values["Submitted At (IST)"]).toBe("22/10/2026 15:30:32 IST");
});
it("round-trips Unicode, commas, quotes, hash signs and embedded newlines", () => {
  const name = '学生, "Name"\n#2';
  const [headers, row] = parse(assessmentResultsCSV(assessment, [{ ...attempt, studentName: name }], "candidates"));
  expect(row[headers.indexOf("Student Name")]).toBe(name);
});
it("exports one row per raw attempt with attempt-specific headings and metrics", () => {
  const [headers, first, second] = parse(assessmentResultsCSV(assessment, [attempt, { ...attempt, attemptNumber: 2, score: 85 }], "all_attempts"));
  expect(headers).toContain("Attempt Number");
  expect(headers).toContain("Score");
  expect(headers).not.toContain("Best Score");
  expect(headers).not.toContain("All Scores Breakdown");
  expect(first).toHaveLength(headers.length);
  expect(second[headers.indexOf("Attempt Number")]).toBe("2");
  expect(second[headers.indexOf("Score")]).toBe("85");
});
it("marks missing values explicitly without inventing zero grades or submission timestamps", () => {
  const [headers, row] = parse(assessmentResultsCSV(assessment, [{ status: "in_progress", passed: false }], "all_attempts"));
  expect(row.every(value => value.length > 0)).toBe(true);
  expect(row[headers.indexOf("Result")]).toBe("In progress");
  expect(row[headers.indexOf("Submitted At (IST)")]).toBe(RESULT_NOT_AVAILABLE);
  expect(row[headers.indexOf("Total Correct")]).toBe(RESULT_NOT_AVAILABLE);
});
it("uses the assessment mark limit only when the attempt has no mark limit", () => {
  const [headers, row] = parse(assessmentResultsCSV(assessment, [{ score: 55 }], "candidates"));
  expect(row[headers.indexOf("Max Score")]).toBe("110");
  expect(row[headers.indexOf("Percentage (%)")]).toBe("50");
});
it("treats absent UIDs consistently and escapes spreadsheet formulas", () => {
  expect(resultText("UNKNOWN")).toBe(RESULT_NOT_AVAILABLE);
  expect(resultText(undefined)).toBe(RESULT_NOT_AVAILABLE);
  expect(resultText("00123")).toBe("00123");
  const [headers, row] = parse(assessmentResultsCSV(assessment, [{ studentName: '=HYPERLINK("example.com")' }], "all_attempts"));
  expect(row[headers.indexOf("Student Name")]).toBe('\'=HYPERLINK("example.com")');
});
