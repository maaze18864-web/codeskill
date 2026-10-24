# Experiment practice and assessments

Each lab experiment has a practice list and a separate assessment list. Admins manage both from **Labs → Catalog → experiment**. Students see the available questions, their marks, and assessment contributions on the experiment overview.

## SQL practice

**Add SQL question** opens an authoring form for instructions, schema SQL, starter query, marks, and public/hidden datasets. Each dataset contains seed SQL and the expected result table. Expected results use JSON with `columns` and `rows`; column names and duplicate rows matter. Enable ordered results when the question requires an `ORDER BY`.

Students use a split query editor with the question, schema, examples, and tabular results. **Run query** checks public examples without awarding marks. **Submit query** checks all datasets and saves the query, progress, and best score. Hidden datasets return a verdict only. Partial credit is `passed datasets / total datasets × question marks`.

The SQL engine uses SQLite through `sql.js` in disposable Node worker threads. It does not connect student SQL to the application PostgreSQL database. This version supports one read-only `SELECT`/`WITH` query per execution, not DDL/DML exercises or PostgreSQL-specific syntax. Every dataset receives a fresh database. Worker time, memory, output, concurrency, queue, and per-user limits bound execution; no Docker service or external SQL provider is required for these questions.

## Assessments and marks

**Create assessment** opens the existing assessment builder with the experiment attached. Select at least two questions, configure each question's marks, and set its schedule, attempts, targeting, and proctoring as usual. SQL practice questions are also saved as coding questions in the Question Bank for selection. Edits create a new bank version so existing assessments retain their original SQL content.

Students enter through the standard assessment briefing and take pages. SQL questions use the query editor inside the existing timed environment; autosave, question navigation, proctoring, final submission, and scorecards continue through the assessment system. Final grades are calculated on the server using the question marks configured in that assessment, rather than the bank's default marks.

The assessment's **lab contribution** is independent of its exam total. For example, 16.5/20 exam marks contributes 24.75/30 lab marks. The experiment uses the best completed attempt, capped to the configured contribution. Admins can edit practice marks and assessment contributions inline. Changing practice marks proportionally rescales saved practice scores; changing an assessment contribution leaves its exam score intact.

Published experiment assessments require active enrollment in a section assigned to the published lab, in addition to normal assessment targeting and schedule checks. Direct assessment URLs do not bypass this enrollment check. Coding practice progress is derived from a verified, caller-owned submission; the browser cannot assign a verdict or score. Project starters remain editable workspaces and do not yet receive automated project grades.

## Schema and local fixtures

Build the backend, then run the additive Labs migration before starting the updated API:

```bash
cd backend-nestjs
npm run build
npm run db:labs:migrate
```

The migration adds SQL problem/version fields, saved SQL query progress, and the assessment's experiment/contribution fields. It preserves existing coding problems, project workspaces, assessment attempts, and marks.

For the existing local test student, seed the base labs first when needed, then upgrade their experiment content:

```bash
NODE_ENV=development node dist/seeds/seed-student-test-labs.js
NODE_ENV=development node dist/seeds/seed-lab-experiment-assessments.js
```

These fixture scripts require a loopback database and the existing `student.test@codeskill.local` account. They do not reset its password. The upgrade creates two SQL practice questions per DBMS experiment and one two-question assessment per experiment across the three test labs. Local SQL practice marks are 10 and 15; assessment question marks are 7 and 13 with a 30-mark lab contribution. DSA/Fullstack fixtures include knowledge-check assessments; admins can choose coding questions in the same builder. Existing student project files are preserved when the old DBMS project links are converted to SQL practice.

No production seed, infrastructure deployment, or judge configuration change is needed for this feature.

## Verification

```bash
(cd backend-nestjs && npm test -- --runInBand --watchman=false --testPathPatterns 'src/(sql|labs|assessments)/')
(cd frontend-v2 && npm test -- --runInBand --watchman=false --runTestsByPath src/__tests__/components/SqlQuestionEditor.test.tsx src/__tests__/components/LabExperimentOverview.test.tsx src/__tests__/components/LabExperimentWorkspace.test.tsx)
```

Actual local API checks also cover partial SQL credit, hidden-result redaction, saved queries, practice score rescaling, per-assessment marks, weighted lab totals, and denied access for an unenrolled account. Temporary verification records are removed afterward, leaving seeded assessment attempts available for manual testing.
