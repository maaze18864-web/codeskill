# 02 — Comprehensive Issue Remediation Log

This document tracks the verified remediation status, root cause analysis, implementation diffs, and test evidence for all 26 identified engineering issues across the CodeSkill full-stack architecture.

---

## Master Remediation Status Table

| ID | Issue Summary | Severity | Sprint | Status | Target File(s) | Verification Suite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ISSUE-SEC-001` | Piston/Judge0 sandbox container escape (`--privileged` Docker + IMDS hop_limit=2) | CRITICAL | Sprint A | `[COMPLETED]` | `ec2-asg/main.tf`, `piston.sh.tftpl`, `judge0.sh.tftpl` | Terraform syntax & config validation |
| `ISSUE-INF-004` | Wildcard `"Resource": "*"` IAM policy on backend role for Secrets Manager/SSM | HIGH | Sprint A | `[COMPLETED]` | `modules/iam/main.tf`, `environments/production/main.tf` | IAM policy least-privilege scoping |
| `ISSUE-INF-008` | Cloud Map execution nodes leaving orphaned DNS records on ASG scale-in | MEDIUM | Sprint A | `[COMPLETED]` | `piston.sh.tftpl`, `judge0.sh.tftpl` | systemd `deregister-cloudmap.service` hook |
| `ISSUE-DAT-001` | Assessment CAS status evaluating lockup trap on network timeout or worker crash | CRITICAL | Sprint B | `[COMPLETED]` | `backend-nestjs/src/assessments/assessments.service.ts` | `assessment-integrity.security.spec.ts` |
| `ISSUE-PRF-001` | Synchronous code grading on Express loop triggering Nginx 504 timeouts | HIGH | Sprint B | `[COMPLETED]` | `backend-nestjs/src/assessments/assessments.service.ts` | Bounded chunk processing in assessment suite |
| `ISSUE-FE-001` | Frontend submission retry loop prematurely aborting on HTTP 409 Conflict | HIGH | Sprint B | `[COMPLETED]` | `frontend-v2/src/app/assessments/[id]/take/page.tsx` | `AssessmentCameraCompletion.test.tsx` |
| `ISSUE-CON-001` | Contest reattempt grant TOCTOU race outside transaction boundary | HIGH | Sprint C | `[COMPLETED]` | `backend-nestjs/src/contests/contests.service.ts` | `contests.service.spec.ts` |
| `ISSUE-INF-001` | RDS PostgreSQL connection pool exhaustion (200 limit vs 340 pool demand) | HIGH | Sprint C | `[COMPLETED]` | `database.module.ts`, `backend.sh.tftpl` | `database.module.ts` pool bounds |
| `ISSUE-RES-001` | `RedisService.retryStrategy` returning `null` after 3 retries, dropping connections | HIGH | Sprint C | `[COMPLETED]` | `backend-nestjs/src/redis/redis.service.ts` | `redis.service.spec.ts` |
| `ISSUE-INF-003` | Backend ASG user-data running un-locked DDL migrations on node startup | HIGH | Sprint C | `[COMPLETED]` | `deployment/terraform/modules/ec2-asg/user-data/backend.sh.tftpl` | Boot migration removal & standalone runner |
| `ISSUE-SEC-002` | Unescaped wildcard `ILIKE` injection matching ambiguous or privileged users | HIGH | Sprint D | `[COMPLETED]` | `backend-nestjs/src/auth/auth.service.ts` | `auth.security.spec.ts` |
| `ISSUE-SEC-003` | SmartThrottler IP rate limit bypass via spoofed `X-Forwarded-For` | MEDIUM | Sprint D | `[COMPLETED]` | `backend-nestjs/src/main.ts`, `smart-throttler.guard.ts` | `smart-throttler.guard.spec.ts` |
| `ISSUE-SEC-004` | Production ElastiCache Redis cluster unencrypted in transit and at rest | MEDIUM | Sprint D | `[COMPLETED]` | `modules/redis/variables.tf`, `environments/production/main.tf` | Terraform variable encryption validation |
| `ISSUE-INF-002` | ALB backend cookie stickiness (3600s) severing active WebSockets during refresh | MEDIUM | Sprint D | `[COMPLETED]` | `modules/alb/main.tf`, `modules/alb/variables.tf` | ALB stickiness configuration check |
| `ISSUE-INF-005` | Production ALB operating without AWS WAF Web ACL association | MEDIUM | Sprint D | `[COMPLETED]` | `terraform/environments/production/main.tf` | WAF Web ACL association validation |
| `ISSUE-INF-007` | Next.js SSR internal backend routing egressing through NAT Gateway | MEDIUM | Sprint D | `[COMPLETED]` | `backend.sh.tftpl`, `frontend.sh.tftpl`, `main.tf` | Internal DNS discovery routing validation |
| `ISSUE-DAT-002` | Cross-shard submission pagination $O(\text{shards} \times (\text{skip} + \text{take}))$ memory explosion | MEDIUM | Sprint E | `[COMPLETED]` | `backend-nestjs/src/database/sharding/submission-store.ts` | `submission-store.spec.ts` |
| `ISSUE-DAT-003` | Assessment reports controller N+1 queries and blocking PDF generation | MEDIUM | Sprint E | `[COMPLETED]` | `backend-nestjs/src/reports/reports.controller.ts` | `reports.controller.spec.ts` |
| `ISSUE-PRF-002` | Sequential `bcrypt.hash` during batch student CSV import starving threadpool | HIGH | Sprint E | `[COMPLETED]` | `backend-nestjs/src/students/students.service.ts` | `students.bulk-import.spec.ts` |
| `ISSUE-SEC-005` | Vulnerable `xlsx` parsing allowing prototype pollution & DoS | MEDIUM | Sprint E | `[COMPLETED]` | `students.service.ts`, `questions.service.ts` | `students.bulk-import.spec.ts` |
| `ISSUE-FE-002` | Proctoring webcam/audio streams and MediaPipe WASM leak on submission error | MEDIUM | Sprint F | `[COMPLETED]` | `frontend-v2/src/app/assessments/[id]/take/page.tsx`, `assessment-face-verification.ts` | `AssessmentCameraCompletion.test.tsx`, `AssessmentFaceWarnings.test.tsx`, `useAssessmentMedia.test.tsx` |
| `ISSUE-INF-006` | S3 bucket omitting default encryption and TLS enforcement | MEDIUM | Sprint F | `[COMPLETED]` | `terraform/modules/s3/main.tf` | S3 SSE-S3 AES256 & TLS Policy |
| `ISSUE-INF-009` | Mutable `:latest` Docker image tags in production launch templates | LOW | Sprint F | `[COMPLETED]` | `terraform/environments/production/variables.tf` | Pinned `v2.0.0` image tags |
| `ISSUE-INF-010` | Zero CloudWatch alarms or dashboards for AWS native metrics | LOW | Sprint F | `[COMPLETED]` | `terraform/modules/monitoring/main.tf` | 4 Native Free Tier CloudWatch alarms |
| `ISSUE-OBS-001` | Axiom Winston transport unhandled async promise rejection | LOW | Sprint F | `[COMPLETED]` | `backend-nestjs/src/observability/logger/axiom.winston-transport.ts` | `axiom.winston-transport.spec.ts` |
| `ISSUE-QA-001` | CI pipeline omitting shard integration, concurrency tests, and broken E2E suite | LOW | Sprint F | `[COMPLETED]` | `backend-nestjs/test/app.e2e-spec.ts`, `.github/workflows/deploy.yml` | CI pipeline validation & E2E suite fix |

---

## Detailed Remediation Entries (1 – 26)

### ISSUE-SEC-001: Piston/Judge0 Sandbox Container Isolation & IMDS Hardening
- **Root Cause**: Launch template allowed `http_put_response_hop_limit = 2` and container runtime had `--privileged` or unconstrained capabilities, allowing untrusted student execution code to reach the EC2 Instance Metadata Service and execute privileged system calls.
- **Remediation**:
  1. Enforced `http_put_response_hop_limit = 1` in `terraform/modules/ec2-asg/main.tf` to prevent Docker container bridge networking from querying IMDSv2.
  2. In `piston.sh.tftpl` and `judge0.sh.tftpl`, dropped all root capabilities (`--cap-drop ALL`), set memory ceilings (`--memory=1536m --memory-swap=1536m`), constrained CPUs (`--cpus=1.5`), and set process limits (`--pids-limit=256`).
- **Verification**: Verified via Terraform launch template variables and template validation.

### ISSUE-INF-004: IAM Least Privilege Scoping for SSM & Secrets Manager
- **Root Cause**: Backend EC2 IAM role used wildcard `Resource: "*"` for SSM parameters and Secrets Manager secrets.
- **Remediation**: In `terraform/modules/iam/main.tf` and `terraform/environments/production/main.tf`, scoped policies strictly to `arn:aws:ssm:${region}:${account_id}:parameter/codeskill/${environment}/*` and `arn:aws:secretsmanager:${region}:${account_id}:secret:codeskill/${environment}/*`.
- **Verification**: Inspected and verified IAM policy documents and Terraform plan syntax.

### ISSUE-INF-008: AWS Cloud Map Automatic Deregistration Hook
- **Root Cause**: When ASG scaled in or spot instances terminated, Cloud Map SRV/A records remained registered, routing judge traffic to dead IP addresses.
- **Remediation**: Created `/etc/systemd/system/deregister-cloudmap.service` in `piston.sh.tftpl` and `judge0.sh.tftpl` triggered on `shutdown.target` before network teardown.
- **Verification**: Verified systemd unit structure and bash preflight execution.

### ISSUE-DAT-001: Assessment Evaluation Lockup Recovery
- **Root Cause**: Submissions set to `status = 'evaluating'` via compare-and-swap were never released if worker nodes died or network calls timed out, trapping the exam indefinitely.
- **Remediation**: In `assessments.service.ts`, added 60-second lease expiration detection allowing re-evaluation and added `try-catch` rollback to `status = 'pending'` on synchronous grading failure.
- **Verification**: Verified via `backend-nestjs/src/assessments/assessment-integrity.security.spec.ts` (3 tests passed).

### ISSUE-PRF-001: Bounded Concurrency Assessment Grading
- **Root Cause**: Assessment submissions evaluated up to 50 questions simultaneously inside an unmetered `Promise.all`, exhausting HTTP sockets and exceeding Nginx 60s gateway timeouts.
- **Remediation**: Implemented chunked evaluation with bounded concurrency ($N=5$) and 15s per-question execution timeouts.
- **Verification**: Verified via `assessment-integrity.security.spec.ts`.

### ISSUE-FE-001: Frontend Submission Resilience on HTTP 409
- **Root Cause**: When backend returned HTTP 409 Conflict (already evaluating / idempotent retry), the frontend aborted with an error modal, confusing students.
- **Remediation**: In `frontend-v2/src/app/assessments/[id]/take/page.tsx`, treated 409 Conflict as a transient in-flight state and initiated status polling instead of throwing.
- **Verification**: Verified via `frontend-v2/src/__tests__/components/AssessmentCameraCompletion.test.tsx`.

### ISSUE-CON-001: Contest Reattempt Grant TOCTOU Concurrency
- **Root Cause**: `reAttempt()` in `contests.service.ts` read attempt counts and updated records outside a pessimistic database lock, allowing concurrent requests to bypass contest attempt limits.
- **Remediation**: Wrapped attempt increment in an isolated TypeORM transaction using `setLock('pessimistic_write')` (`SELECT FOR UPDATE`).
- **Verification**: Verified via `backend-nestjs/src/contests/contests.service.spec.ts` (3 tests passed).

### ISSUE-INF-001: RDS PostgreSQL Connection Pool Sizing
- **Root Cause**: RDS instance maximum connections was 200, but multi-instance backend ASG configured unbounded pools (up to 340 total connections), causing fatal connection refused errors during peak exams.
- **Remediation**: Set `DB_POOL_MAX=15` and `DB_POOL_MIN=2` in `database.module.ts` and `backend.sh.tftpl`, ensuring total cluster connection demand remains strictly below 120 across all backend replicas and shard routers.
- **Verification**: Verified pool configuration in `database.module.ts`.

### ISSUE-RES-001: Continuous Exponential Backoff for Redis Reconnections
- **Root Cause**: `redis.service.ts` returned `null` after 3 failed reconnection attempts, permanently disconnecting Redis and BullMQ until the backend process was manually restarted.
- **Remediation**: Implemented exponential backoff with random jitter up to a 3-second cap that never returns `null`.
- **Verification**: Verified via `backend-nestjs/src/redis/redis.service.spec.ts` (2 tests passed).

### ISSUE-INF-003: Removal of Uncontrolled ASG Boot Migrations
- **Root Cause**: `backend.sh.tftpl` executed `npm run typeorm:sync` on container boot on every autoscaled node, risking race conditions and schema locks under traffic spikes.
- **Remediation**: Removed automatic DDL execution from `backend.sh.tftpl`. Migrations are now restricted to pre-deployment CI/CD jobs using `run-practice-submission-source.js` with advisory locks.
- **Verification**: Inspected `backend.sh.tftpl`.

### ISSUE-SEC-002: Wildcard ILIKE Parameterized Sanitization
- **Root Cause**: `auth.service.ts` constructed TypeORM `ILike(\`%${identifier}%\`)` searches, allowing malicious users to query `%` or `_` and authenticate as arbitrary users.
- **Remediation**: Added `escapeIlike` helper escaping `%`, `_`, and `\` characters, and replaced broad substring matching with strict exact-match or prefix-match queries.
- **Verification**: Verified via `backend-nestjs/src/auth/auth.security.spec.ts` (4 tests passed).

### ISSUE-SEC-003: Right-to-Left IP Extraction & Proxy Trust
- **Root Cause**: `smart-throttler.guard.ts` read the leftmost IP from `X-Forwarded-For` without validating proxy hops, enabling trivial rate-limiting bypass via spoofed headers.
- **Remediation**: Added `app.set('trust proxy', 1)` in `main.ts` and implemented robust right-to-left IP extraction in `smart-throttler.guard.ts`.
- **Verification**: Verified via `backend-nestjs/src/common/guards/smart-throttler.guard.spec.ts` (4 tests passed).

### ISSUE-SEC-004: Redis Encryption at Rest and in Transit
- **Root Cause**: Redis cluster Terraform module had encryption disabled by default.
- **Remediation**: Defaulted `transit_encryption_enabled` and `at_rest_encryption_enabled` to `true` in `terraform/modules/redis/variables.tf` and passed `redis_tls = "true"` in production environment.
- **Verification**: Verified Terraform variable definitions and module configuration.

### ISSUE-INF-002: ALB Cookie Stickiness WebSocket Teardown
- **Root Cause**: ALB target group enabled cookie stickiness with 3600-second duration, pinning WebSocket and HTTP traffic to single instances and triggering disconnect storms during instance refresh.
- **Remediation**: Added `backend_stickiness_enabled = false` to `terraform/modules/alb/` and disabled stickiness on production backend target groups.
- **Verification**: Verified Terraform ALB target group attributes.

### ISSUE-INF-005: AWS WAF Association with Production ALB
- **Root Cause**: WAF module existed but was never associated with the production Application Load Balancer.
- **Remediation**: Added `aws_wafv2_web_acl_association` linking `module.waf.web_acl_arn` to `module.alb.alb_arn` in `terraform/environments/production/main.tf`.
- **Verification**: Verified Terraform resource association.

### ISSUE-INF-007: Private Cloud Map Routing for Next.js SSR
- **Root Cause**: Next.js server-side rendering made backend API calls via public ALB URL, hair-pinning traffic through the NAT Gateway and incurring $0.045/GB data transfer charges.
- **Remediation**: Registered backend instances in Cloud Map (`backend.codeskill.internal:5001/api`) and updated `INTERNAL_BACKEND_URL` in `frontend.sh.tftpl` to route directly over private VPC subnets.
- **Verification**: Verified Cloud Map registration in `backend.sh.tftpl` and URL injection in `frontend.sh.tftpl`.

### ISSUE-DAT-002: Cross-Shard Submission Keyset Cursor Pagination
- **Root Cause**: `SubmissionStore.findMany()` retrieved $(\text{skip} + \text{take})$ rows from every shard and sorted them in Node.js memory, causing memory spikes at large offsets.
- **Remediation**: Clamped legacy offset pagination to 2000 and implemented keyset cursor pagination (`cursor: { createdAt, id }`), querying only `take` rows per shard.
- **Verification**: Verified via `backend-nestjs/src/database/sharding/submission-store.spec.ts` (6 tests passed).

### ISSUE-DAT-003: Assessment Reports Batch Querying
- **Root Cause**: `reports.controller.ts` iterated over submitted questions with sequential `findOne` queries ($N+1$ query pattern).
- **Remediation**: Replaced loop with a single batched `In(questionIds)` query.
- **Verification**: Verified via `backend-nestjs/src/reports/reports.controller.spec.ts` (2 tests passed).

### ISSUE-PRF-002: Bounded Batch Student Password Hashing
- **Root Cause**: CSV student import hashed hundreds of passwords sequentially with `bcrypt.hash(..., 10)`, blocking the Node.js event loop for tens of seconds.
- **Remediation**: Clamped file upload to 500 rows and processed hashes in bounded chunks of 5 with `Promise.all`.
- **Verification**: Verified via `backend-nestjs/src/students/students.bulk-import.spec.ts` (3 tests passed).

### ISSUE-SEC-005: Hardened Spreadsheet Parsing & Prototype Pollution Defense
- **Root Cause**: Insecure options in `XLSX.read` allowed spreadsheet formula execution and prototype pollution attacks via crafted XLSX files.
- **Remediation**: Configured safe parsing options (`cellFormula: false`, `cellHTML: false`, `raw: true`, `dense: true`) and implemented recursive row sanitization stripping `__proto__`, `constructor`, and `prototype` in `students.service.ts` and `questions.service.ts`.
- **Verification**: Verified via `backend-nestjs/src/students/students.bulk-import.spec.ts`.

### ISSUE-FE-002: Camera Stream and MediaPipe WASM Resource Cleanup
- **Root Cause**: Unmounting assessment or experiencing submission network failure left webcam/mic tracks open and MediaPipe WASM memory allocated.
- **Remediation**: Added `disposeFaceLandmarker()` to `assessment-face-verification.ts` and ensured explicit track stoppage on unmount and submission completion in `frontend-v2/src/app/assessments/[id]/take/page.tsx`.
- **Verification**: Verified via `AssessmentCameraCompletion.test.tsx`, `AssessmentFaceWarnings.test.tsx`, and `useAssessmentMedia.test.tsx` (15 tests passed).

### ISSUE-INF-006: S3 Server-Side Encryption and TLS Enforcement
- **Root Cause**: S3 bucket lacked bucket-level encryption and allowed unencrypted HTTP access.
- **Remediation**: Configured default SSE-S3 (`AES256`) encryption and added bucket policy denying all `s3:*` actions when `aws:SecureTransport = false`.
- **Verification**: Verified Terraform S3 module resource blocks.

### ISSUE-INF-009: Pinned Docker Image Tags in Production Launch Templates
- **Root Cause**: Launch template defaulted to mutable `:latest` tags, preventing deterministic deployments and rollbacks.
- **Remediation**: Pinned default image tags to immutable version `v2.0.0` in `terraform/environments/production/variables.tf`.
- **Verification**: Verified variables file.

### ISSUE-INF-010: Zero-Cost Native CloudWatch Metric Alarms
- **Root Cause**: Infrastructure lacked CloudWatch alarms for RDS CPU, storage, Redis CPU, and ALB errors.
- **Remediation**: Added 4 native CloudWatch metric alarms in `terraform/modules/monitoring/main.tf` alerting to SNS, fully covered by AWS Free Tier (up to 10 alarms free).
- **Verification**: Verified Terraform monitoring module configuration.

### ISSUE-OBS-001: Axiom Winston Transport Async Fail-Open Guard
- **Root Cause**: `axiom.winston-transport.ts` did not handle async promise rejections or background batch flush errors from `@axiomhq/js`, risking uncaught exception crashes during network drops.
- **Remediation**: Added `onError` handler to Axiom client constructor and wrapped ingestion in safe promise check to guarantee fail-open logging.
- **Verification**: Verified via `backend-nestjs/src/observability/logger/axiom.winston-transport.spec.ts` (2 tests passed).

### ISSUE-QA-001: CI Workflow Testing Coverage & E2E Assertion Fix
- **Root Cause**: `backend-nestjs/test/app.e2e-spec.ts` contained outdated assertion expecting raw `'Hello World!'` instead of JSON status response, and CI omitted automated database/service validation.
- **Remediation**: Updated `app.e2e-spec.ts` to assert against `{ success: true, status: 'ok', ... }` and added postgres and redis service containers to `.github/workflows/deploy.yml`.
- **Verification**: Verified backend type-check and E2E test file.
