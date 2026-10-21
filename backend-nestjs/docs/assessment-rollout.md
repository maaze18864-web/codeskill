# Assessment loading and container rollout

The candidate list and overview read `assessment_attempts`, including `resumeCount`,
`captures`, `rawScore`, `proctoringPenalty`, `mode`, and `submissionPolicy`. An older
database can therefore serve the admin assessment list while candidate requests
return HTTP 500. The former briefing UI displayed every failure as “Assessment Not
Found”, including these server errors.

The backend image now runs `dist/database/run-assessment-schema-migrations.js`
before starting the API. It applies the existing idempotent assessment migrations
in one transaction under the shared rollout advisory lock. Failure stops container
startup. This runner only adds/backfills assessment fields; it does not run the
older runner's partition conversion or alter student credentials.

Build and deploy the new backend image through the existing deployment workflow.
The current production systemd container command uses the image's default CMD, so
this change does not require a Terraform apply or a manual database sync. Deploy
the frontend image too for accurate loading errors and the assigned-assessment
section on Home. Database permissions must allow the existing migration DDL.

After rollout, confirm `/api/assessments/my-assessments` and the overview endpoint
for an existing assigned assessment return 200 while signed in. If a 500 persists,
use its `x-request-id` to locate the API log and inspect the database error before
changing infrastructure. A genuine 404 means the ID/code was not found in the live
database; records created only on localhost are not copied by deploying code.
