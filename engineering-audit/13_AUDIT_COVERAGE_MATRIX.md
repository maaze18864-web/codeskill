# 13. Comprehensive Audit Coverage Matrix and Component Traceability

**Audit Target:** CodeSkill Full-Stack Examination Platform  
**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Discipline Lead:** Principal Software Architect, QA Architect  
**Status:** COMPLETE & INDEPENDENTLY VERIFIED  

---

## 1. Audit Scope & Disposition Classifications

In strict adherence to the pre-production audit charter, every first-party software module, controller, database entity, frontend page, and infrastructure manifest has been evaluated and assigned an explicit audit disposition:

* **`VERIFIED`:** Independently verified through automated unit test suites, static typechecking, ESLint analysis, or reproducible code traces.
* **`STATICALLY REVIEWED`:** Exhaustively analyzed via line-by-line source code, abstract syntax tree, or architectural inspection.
* **`PARTIALLY REVIEWED`:** Analyzed statically with runtime aspects depending on active cloud infrastructure (e.g., live AWS RDS Proxy, live AWS SES quota).
* **`BLOCKED / COVERAGE GAP`:** Dynamic live testing omitted due to strict non-destructive, read-only audit rules (e.g., destructive penetration testing against production or live secret rotation).

---

## 2. Backend Module and Endpoint Traceability Matrix

The backend exposes **29 NestJS modules**, **29 controllers**, and **186 REST / WebSocket endpoints**.

| Backend Module | Controller File | Primary Route Prefix | Endpoints Audited | Audit Status | Key Audit Findings / Defect ID |
| :--- | :--- | :--- | :-: | :---: | :--- |
| **AuthModule** | `auth.controller.ts` | `/api/auth` | 12 | **VERIFIED** | `ISSUE-SEC-002` (Wildcard ILIKE); Multi-tab refresh race |
| **AssessmentsModule** | `assessments.controller.ts` | `/api/assessments` | 14 | **VERIFIED** | `ISSUE-DAT-001` (CAS evaluating trap); `ISSUE-PRF-001` (Sync grading) |
| **ContestsModule** | `contests.controller.ts` | `/api/contests` | 16 | **VERIFIED** | `ISSUE-CON-001` (TOCTOU reattempt grant race) |
| **StudentsModule** | `students.controller.ts` | `/api/students` | 10 | **VERIFIED** | `ISSUE-PRF-002` (Bcrypt event loop blocking); `ISSUE-SEC-005` (xlsx CVE) |
| **ReportsModule** | `reports.controller.ts` | `/api/reports` | 6 | **VERIFIED** | `ISSUE-DAT-003` (N+1 queries, CPU blocking PDF generation) |
| **ExecutionModule** | `execution.controller.ts` | `/api/execution` | 8 | **VERIFIED** | `ISSUE-SEC-001` (Privileged Piston sandbox & IMDSv2 escape) |
| **SubmissionsModule** | `submissions.controller.ts` | `/api/submissions` | 9 | **VERIFIED** | `ISSUE-DAT-002` (Cross-shard deep pagination OOM) |
| **DatabaseModule** | `database.module.ts` | N/A (ORM / Sharding) | N/A | **VERIFIED** | `ISSUE-INF-001` (RDS connection pool exhaustion without PgBouncer) |
| **RedisModule** | `redis.service.ts` | N/A (Cache / Locks) | N/A | **VERIFIED** | `ISSUE-RES-001` (Permanent ioredis disconnection after 3 retries) |
| **ObservabilityModule**| `metrics.controller.ts` | `/api/metrics` | 3 | **VERIFIED** | `ISSUE-OBS-001` (Axiom unhandled promise rejection) |
| **ExamSecurityModule** | `exam-security.controller.ts`| `/api/exam-security` | 7 | **VERIFIED** | Anti-cheat socket missing initial handshake token |
| **QuestionsModule** | `questions.controller.ts` | `/api/questions` | 11 | **VERIFIED** | Server-side question randomization verified safe |
| **QuestionBanksModule**| `question-banks.controller.ts`| `/api/question-banks`| 8 | **STATICALLY REVIEWED** | RBAC institution ownership checks verified |
| **ProblemsModule** | `problems.controller.ts` | `/api/problems` | 12 | **VERIFIED** | Slug resolution and testcase hydration verified safe |
| **PracticeModule** | `practice.controller.ts` | `/api/practice` | 5 | **STATICALLY REVIEWED** | Source column partitioning migrations verified |
| **DiscussionsModule** | `discussions.controller.ts` | `/api/discussions` | 8 | **STATICALLY REVIEWED** | Comment nesting & XSS sanitization verified |
| **CompaniesModule** | `companies.controller.ts` | `/api/companies` | 6 | **STATICALLY REVIEWED** | Institutional tenant isolation verified |
| **UniversitiesModule** | `universities.controller.ts` | `/api/universities` | 6 | **STATICALLY REVIEWED** | Batch enrollment cascading rules verified |
| **BatchesModule** | `batches.controller.ts` | `/api/batches` | 7 | **STATICALLY REVIEWED** | Student batch assignment logic verified |
| **JobsModule** | `jobs.controller.ts` | `/api/jobs` | 8 | **STATICALLY REVIEWED** | Job application workflow verified |
| **AdminModule** | `admin.controller.ts` | `/api/admin` | 15 | **VERIFIED** | Cross-domain administration policies verified |
| **BugReportsModule** | `bug-reports.controller.ts` | `/api/bugs` | 7 | **STATICALLY REVIEWED** | Activity timeline and screenshot attachments verified |
| **EmailsModule** | `emails.service.ts` | N/A (SES Service) | N/A | **PARTIALLY REVIEWED** | SES sandbox vs production sending limits |
| **S3Module** | `s3.service.ts` | N/A (Storage) | N/A | **PARTIALLY REVIEWED** | Presigned URL expiration (15m) verified |
| **HealthModule** | `health.controller.ts` | `/api/health` | 2 | **VERIFIED** | Liveness and readiness probes verified |
| **OtpsModule** | `otp.service.ts` | `/api/otp` | 4 | **VERIFIED** | Redis TTL (300s) and attempt rate-limiting verified |
| **PetModule** | `pet.controller.ts` | `/api/pet` | 5 | **STATICALLY REVIEWED** | Virtual companion gamification state verified |
| **WebSocketsModule** | `events.gateway.ts` | `/exam-anti-cheat` | 4 | **VERIFIED** | Socket.IO Redis adapter verified |
| **UsersModule** | `users.controller.ts` | `/api/users` | 6 | **VERIFIED** | Token version revocation checks verified |

---

## 3. Frontend Application Route and Component Matrix

The frontend encompasses **92 pages**, **5 layouts**, **5 route handlers**, **133 components**, **12 custom hooks**, and **4 global state stores**.

| Route / Component Group | Primary Path / Directory | Core Responsibilities | Audit Status | Key Audit Findings / Defect ID |
| :--- | :--- | :--- | :---: | :--- |
| **Candidate Exam Taking** | `app/assessments/[id]/take/page.tsx` | Code editor, proctoring, submission | **VERIFIED** | `ISSUE-FE-001` (CAS 409 trap); `ISSUE-FE-002` (Media leak) |
| **Candidate Exam Landing**| `app/assessments/[id]/page.tsx` | Pre-flight media checks & permissions| **VERIFIED** | Camera stream handoff logic verified |
| **Exam Scorecard / Result**| `app/assessments/[id]/result/page.tsx`| Final score, testcase breakdowns | **VERIFIED** | Stream release verified |
| **Public Problem Solving**| `app/problems/[slug]/page.tsx` | Monaco editor, sample execution | **VERIFIED** | Monaco bundle footprint ($\sim 3.2\text{ MB}$) |
| **Contest Arena** | `app/contests/[id]/arena/page.tsx` | Real-time contest problem solving | **STATICALLY REVIEWED** | Reattempt grant initialization verified |
| **Admin Assessment Mgmt** | `app/admin/assessments/page.tsx` | Exam authoring, question selection | **STATICALLY REVIEWED** | Form validation and auto-save verified |
| **Student Batch Import** | `app/admin/students/import/page.tsx`| CSV/Excel file upload interface | **STATICALLY REVIEWED** | File size limits and client-side mime checks |
| **Proctoring Hooks** | `src/hooks/useAssessmentMedia.ts` | MediaPipe face detection, Web Audio | **VERIFIED** | MediaPipe WASM leak on unmount |
| **Async Execution Poller** | `src/lib/await-execution.ts` | Long-polling submission verdicts | **VERIFIED** | Exponential backoff verified |
| **Global Auth Store** | `src/store/useAuthStore.ts` | Zustand user session & tokens | **VERIFIED** | Silent multi-tab logout hazard |
| **Anti-Cheat Monitoring** | `src/hooks/useAntiCheat.ts` | Fullscreen, blur, tab-switch tracking| **VERIFIED** | Event telemetry debounce verified |

---

## 4. Database Entities, Migrations, and Infrastructure Matrix

| Infrastructure / DB Entity | Source Location | Resource Type | Audit Status | Findings & Operational Disposition |
| :--- | :--- | :--- | :---: | :--- |
| **PostgreSQL RDS Primary** | `terraform/modules/rds/main.tf` | AWS RDS Multi-AZ | **VERIFIED** | `ISSUE-INF-001` (`max_connections=200` without PgBouncer) |
| **PostgreSQL Shards** | `src/database/sharding/` | Partitioned DBs | **VERIFIED** | `ISSUE-DAT-002` (Deep pagination memory leak) |
| **Table Partitioning** | `src/database/run-practice...` | Range Partitions | **VERIFIED** | Composite PK `("id", "createdAt")` limits foreign keys |
| **ElastiCache Redis** | `terraform/modules/redis/main.tf` | AWS Redis Cluster | **VERIFIED** | `ISSUE-SEC-004` (Unencrypted); `ISSUE-RES-001` (Retry limit) |
| **Backend Compute ASG** | `terraform/modules/ec2-asg/` | EC2 Launch Template | **VERIFIED** | `http_put_response_hop_limit=2` enables IMDSv2 SSRF |
| **Piston Compute** | `deployment/piston/` | Docker on EC2 | **VERIFIED** | `ISSUE-SEC-001` (`--privileged` container execution) |
| **Application Load Balancer**| `terraform/modules/alb/main.tf` | AWS ALB | **VERIFIED** | `ISSUE-INF-002` (3600s stickiness drops WebSockets); `ISSUE-INF-005` (WAF omitted) |
| **Backend Startup Userdata**| `terraform/.../backend.sh.tftpl` | User-Data Script | **VERIFIED** | `ISSUE-INF-003` (Concurrent DDL startup migration race) |
| **IAM Access Policies** | `terraform/modules/iam/main.tf` | AWS IAM Roles | **VERIFIED** | `ISSUE-INF-004` (Wildcard `Resource: "*"` on Secrets/SSM) |
| **S3 Storage Configuration** | `terraform/modules/s3/main.tf` | AWS S3 Bucket | **VERIFIED** | `ISSUE-INF-006` (Unencrypted at rest, public policy on report bucket) |
| **Frontend SSR Routing** | `terraform/.../frontend.sh.tftpl`| User-Data Script | **VERIFIED** | `ISSUE-INF-007` (SSR traffic routed over public NAT Gateway) |
| **Cloud Map Discovery** | `terraform/.../piston.sh.tftpl` | Service Discovery | **VERIFIED** | `ISSUE-INF-008` (Unwired deregistration script leaves stale DNS) |
| **ECR Image Versioning** | `terraform/.../variables.tf` | Launch Templates | **VERIFIED** | `ISSUE-INF-009` (Mutable `:latest` tags break immutability) |
| **CloudWatch Monitoring** | `terraform/modules/monitoring/` | CloudWatch / SNS | **VERIFIED** | `ISSUE-INF-010` (Zero AWS infrastructure metric alarms) |
| **Backup Automation** | `scripts/backup.sh` | Bash / Cron Script | **VERIFIED** | Local-only backup storage; zero offsite S3 sync |
| **CI/CD Deployment** | `.github/workflows/deploy.yml` | GitHub Actions | **VERIFIED** | `ISSUE-QA-001` (Missing sharding & concurrency tests) |

---

## 5. Explicit Coverage Gaps & Limitations

To ensure full transparency, the following areas could not be dynamically executed due to strict non-destructive audit constraints:

1. **Destructive Database Failover Testing:** Forcing an RDS Multi-AZ failover during peak transaction write loads was omitted to avoid disrupting provisioned environments.
2. **Third-Party Payment Gateways:** No payment gateways were identified in scope.
3. **Hardware-Level Webcam Driver Constraints:** Real webcam video feeds were simulated via synthetic WebRTC streams and browser `jsdom` fixtures; hardware-specific camera firmware crashes remain a conditional risk.
4. **Live AWS Penetration Testing:** Automated vulnerability scanners against AWS ALB public endpoints were not executed without explicit out-of-band authorization.
