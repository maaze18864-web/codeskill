# Lab project exercises

Experiments can contain both existing judged coding problems and project exercises. A project exercise is an admin-authored starter with instructions, supported stack selections, and source files. Replace the code students should implement with meaningful TODO placeholders; do not place reference solutions or secrets in these public starter files.

In **Admin → Labs → Catalog**, select a lab, add an experiment, then choose **Add project exercise**. Generate a supported starter or import one of your own saved projects. Edit its files, title, instructions, difficulty, and score. **Edit starter** changes the version given to future student drafts. Existing student work is preserved. Attach normal practice problems with the existing **Attach problem** action.

Enrolled students open the experiment, read its exercises, and choose **Open project**. The server copies the stored starter into an owner-scoped `project_workspaces` record. Concurrent requests share the same draft through a unique owner/exercise index. Subsequent opens resume that draft. In the project editor, **Instructions**, **Preview**, and **API Client** are available as appropriate for the stack. The back button returns to the experiment. Autosave, explicit Apply, ZIP download, file management, and runtime isolation use the existing project system.

Opening a project marks its lab progress as in progress. Project work is saved; no automatic score or solved verdict is assigned to it. The single-file judge is not a fullstack project grader, and the API rejects attempts to manufacture a project grade through coding-progress requests. Instructor review and automated project grading are separate future work.

## Schema and rollout

Run both additive migrations before deploying the updated API:

```bash
cd backend-nestjs
npm run db:labs:migrate
npm run db:projects:migrate
```

The Labs migration adds `kind` and `projectTemplate` to `lab_experiment_problems` and permits a null practice metadata ID for project exercises. Existing rows retain the coding kind. The project migration adds `lab_problem_id`, `lab_assignment`, and the unique owner/exercise index. Assignment context is a server-authored snapshot; normal project saves cannot replace it. Removing an exercise does not cascade-delete student project files.

No Terraform, AWS resources, judge settings, runtime privileges, or container network policies change for this feature. Existing project runtime availability is still required to run a starter; editing and saving remain available without it.

## Local test content

After building the backend and applying the migrations:

```bash
cd backend-nestjs
NODE_ENV=development node dist/seeds/seed-student-test-labs.js
```

This script refuses a remote database and requires the existing `student.test@codeskill.local` student. It enrolls that account in `LOCAL-TEST-LABS`, then adds three published labs with two experiments each:

| Lab | Exercises |
| --- | --- |
| DSA | Sum of an array; Pair with target sum. Public examples, hidden judge tests, and C++/Python/JavaScript starters. |
| DBMS | Initial project examples; the [SQL/assessment fixture upgrade](lab-experiment-assessments.md) replaces these exercise links with dedicated query-editor questions while preserving existing student projects. |
| Fullstack | Task board CRUD integration; course feedback validation. Complete React UI handlers and Express API logic. |

Only the targeted enrollment and missing test content are added; existing passwords, student drafts, and progress are preserved on repeated runs. DSA metadata remains Draft in the public practice catalog. SQLite data lives inside the disposable project, with no access to the platform PostgreSQL database.

Targeted verification:

```bash
(cd backend-nestjs && npm test -- --runInBand --runTestsByPath src/labs/lab-projects.spec.ts src/labs/labs.service.spec.ts src/projects/projects.service.spec.ts)
(cd frontend-v2 && npm test -- --runInBand --watchman=false --runTestsByPath src/__tests__/components/LabProjectAuthor.test.tsx src/__tests__/components/LabProjectExercises.test.tsx src/__tests__/components/LabExperimentWorkspace.test.tsx)
```
