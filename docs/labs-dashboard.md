# Labs dashboards

The admin Labs overview (`/admin/labs`) covers the institution. The teacher overview (`/teacher/labs`) covers only the authenticated teacher's assigned **subject + section pairs**. Section and subject filters work directly on these dashboards. A teacher assigned to one subject does not gain analytics access to other subjects in the same section. There is no separate analytics page.

## What the numbers mean

- **Students with lab work:** unique active users with an active enrollment in an active section, an assigned published lab, and at least one problem in a published experiment.
- **Participation:** students who have started at least one assigned problem divided by students with lab work. A recorded status change, attempt, or time spent counts as starting.
- **Assigned work completed:** solved student–problem pairs divided by all assigned student–problem pairs, including untouched problems. This replaces the previous touched-problems-only denominator.
- **Needs review:** a student with unfinished work and either three or more recorded attempts on an unsolved problem, or recorded activity followed by at least seven days of inactivity. These are follow-up signals, not automatic judgments about performance.
- **Active in seven days:** students with started work whose latest recorded interaction falls within the preceding seven days.
- **Submission attempts:** cumulative attempts recorded against currently assigned published work. These are not daily submission counts.

The section chart groups subjects under each academic section and compares problem assignment status. Search and sorting apply to all sections; pagination shows eight at a time without discarding the rest. Section-subject tables and experiment tables are also paginated. The participation chart counts people. The experiment table shows where work is solved, still being attempted, or untouched. The follow-up list can switch between flagged students and students who have not started; each list shows at most ten names. Latest activity shows at most six students, ordered by their latest recorded interaction.

**More learning insights** expands additional charts inline, with their library loaded on demand: first solves per UTC day for the last 14 days, student completion bands, latest-activity recency, and average submission attempts per started problem. Effort is normalized by problems started so larger assignment loads do not automatically look worse. A recorded interaction without a submission can fall into the "Under 1" attempt band. Today is a partial day in the first-solve chart; this is not a historical submissions or attendance series.

Overall totals deduplicate a student's identical lab work across multiple sections. Section rows count that section's own students, so summing section rows can exceed the unique overall total. Draft/archived labs, unpublished experiments, inactive users/sections, dropped enrollments, and unrelated historical progress are excluded from learning metrics. Administrative setup counters include all configured records and are labeled separately.

## Implementation and limits

`GET /api/admin/labs/dashboard` preserves the original setup counters and adds `analytics`. Both dashboards accept optional `sectionId` and `labId` UUID query filters; setup counters remain institution-wide while learning metrics are filtered. `GET /api/teacher/labs/dashboard` uses JWT + teacher-role guards and a parameterized database query that checks the authenticated teacher's assignment. Invalid UUID filters return 400; an unassigned section or subject returns an empty scoped snapshot. Students receive 403.

The analytics query reads only primary Labs tables and safe user display fields; it does not query primary submission repositories or shards. All learning metrics come from one PostgreSQL statement snapshot. No new tables or migrations are required. Recharts is loaded on demand for these dashboards; accessible tables and labels provide the underlying counts. Empty data gets a setup explanation instead of a fabricated chart.

The existing Labs progress store is the source of these metrics. It records latest state and cumulative counters, not a complete event history or live attendance. Its existing progress-write endpoint still accepts client-reported status; these dashboards are operational progress views, not a new authoritative grading/audit system. No historical trend or judge failure chart is inferred from incomplete data.

Refresh retrieves a new snapshot; failures are displayed, and existing admin data remains labeled with its previous update time. No polling or external analytics service is added.

## Local scenario data

The additive, idempotent `src/seeds/seed-labs-analytics.ts` script requires `NODE_ENV=development|test`, a loopback `DATABASE_URL`, and explicit `--apply`. It does not run migrations, send emails, enqueue executions, update existing records, or invent judge submissions. New fixture rows use deterministic IDs, `DEMO-LABS-*` section codes, `[Demo]` lab/problem names, and `analytics-demo.*@codeskill.local` users. Demo problem metadata stays Draft, so these fixtures do not populate the public practice catalog.

```bash
cd backend-nestjs
NODE_ENV=development npm run seed:labs:analytics -- --apply
```

The seed creates 20 sections, 460 students, three teachers, six subject labs (including draft/archived/no-content cases), six problems with runnable samples/tests, and synthetic Labs progress. Scenarios include strong/mixed completion, repeated attempts, dormant learners, never-started learners, early interactions without submissions, missing teachers, empty rosters, no published problems, inactive users/sections, dropped enrollments, shared enrollment, and unpublished work. These fixtures evaluate visualization behavior, not concurrency capacity.

Generated local test credentials and section IDs are saved with owner-only permissions in the Git-ignored `.local-dev/labs-analytics-demo.json`. Re-running preserves passwords and progress and inserts no duplicate records. No production database was seeded.

## Focused verification

```bash
cd backend-nestjs
npm test -- --runInBand --watchman=false --runTestsByPath src/labs/labs-dashboard.spec.ts src/labs/labs.service.spec.ts
cd ../frontend-v2
npm test -- --runInBand --watchman=false --runTestsByPath src/__tests__/components/LabsDashboard.test.tsx src/__tests__/components/LabsSectionComparison.test.tsx src/__tests__/components/LabsRoleViews.test.tsx src/__tests__/components/LabsAssignments.test.tsx src/__tests__/components/LabExperimentWorkspace.test.tsx src/lib/lab-workspace.test.ts src/lib/await-execution.test.ts
npm run typecheck
```

The query was also exercised against local PostgreSQL using transaction-scoped temporary tables and automatic rollback: duplicate enrollment deduplication, untouched work, draft/unpublished exclusion, dropped enrollment exclusion, teacher/section isolation, and no-assignment scope. Existing database records were preserved.
