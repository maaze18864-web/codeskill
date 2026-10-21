# Bulk import production repair

## Findings

- AWS WAF's size-label exception used `/import/preview`. Both controllers actually
  preview files at POST `/api/admin/{students,questions}/import`. Uploads therefore
  still hit the managed body-size restriction before reaching NestJS. The new
  anchored exception covers the actual preview, confirm and question auto routes.
  Other managed rules remain enabled; application authentication is unchanged.
- On 2026-10-21, a small unauthenticated live question-preview request reached the
  API (JSON 401); the same endpoint with a larger benign body or the supplied
  CSV returned HTML 403 from `awselb/2.0`. This establishes gateway blocking;
  AWS WAF logs are still needed to identify the deployed terminating rule.
- ALB WAF's 8 KiB body **inspection** limit is not the application's upload limit.
  The API allows 15 MiB question files and 10 MiB student files. The generated EC2
  legacy Nginx configuration allowed only 10 MiB total (the older ASG template
  omitted the limit entirely). Both now allow 20 MiB including
  multipart framing; per-file limits and the 4 MiB JSON parser limit remain.
- Question confirmation already batches JSON below 2 MiB. Student confirmation
  already sends 200 rows per request with a server guard of 500. These remain.
- Missing nested DTO transformation on question updates could serialize edited
  tests/examples/code as empty arrays. Explicit nested DTO validation now preserves
  their fields and rejects malformed nested arrays. Public Run cases include
  authored examples even when all additional judge cases are hidden. Hidden cases
  remain judge-only. Imported Python starter aliases and execution-limit upserts
  are preserved as well.
- The supplied CSV contains many empty trailing columns/rows. The same file parses
  locally; its size makes the gateway issue visible. It is not committed here.

## Required release steps

1. Review/plan/apply the WAF change through the production Terraform environment
   using the infrastructure team's existing state and credentials. An application
   merge alone does not update the deployed WAF rule.
2. The current split production ALB routes `/api/*` directly to backend containers;
   it does not use these legacy Nginx templates. For installations using those
   templates, roll out the updated EC2 launch template/user data, or update the existing Nginx
   body limit using the normal managed configuration procedure. Validate with
   `nginx -t` before reloading. Editing user data alone does not rerun it on an
   already running instance. The root Docker Nginx config already allows 25 MiB.
3. Deploy the API and frontend changes. On a controlled account, preview a >8 KiB
   file, confirm it, then reopen a coding question and check public/hidden tests.
   Check WAF sampled requests if 403 persists; do not disable all managed rules.

No infrastructure was applied, production records imported, or production judge
configuration changed while preparing this PR. Local judge checks do not prove
that production Judge0/Piston workers are available.

## Checks

Run `python3 -m unittest discover -s terraform/tests -p test_import_limits.py` for
the route/limit regression checks. Run the focused DTO, bulk-import, editor and
public-run-case Jest suites for application regressions.

Validation on the latest upstream base: focused question/student import and DTO
tests, editor/public-case tests, gateway path/limit tests, backend and frontend
TypeScript checks, and targeted frontend lint pass. Compiler execution tests pass
with local toolchain access. Terraform CLI is unavailable here, so provider-backed
`terraform validate` and a production plan/apply remain release checks.
