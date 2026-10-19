# 01. EXECUTIVE SUMMARY: PRE-PRODUCTION ENGINEERING AUDIT

**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Assessment Date:** 2026-10-18  
**Scope:** Full-Stack Repository (Backend NestJS, Frontend Next.js App Router, Terraform IaC, PostgreSQL Database, Redis/BullMQ, Piston/Judge0 Execution Sandbox, Docker, CI/CD, Nginx)  
**Audit Team Disciplines:** Principal Software Architect, Staff Frontend Engineer, Staff Backend Engineer, Database Performance Architect, Distributed Systems & Concurrency Engineer, SRE, Application Security & Threat Modeling Architect, Cloud DevOps Engineer, Performance & Load Testing Architect, QA Automation Architect, API Architect, Observability Engineer, Data Reliability Engineer, Accessibility Engineer, Supply Chain Security Engineer, Data Governance & Privacy Engineer, FinOps Engineer.

---

## 1. Executive Verdict & Production-Readiness Assessment

> [!CAUTION]
> **OVERALL VERDICT: NOT PRODUCTION READY FOR HIGH-CONCURRENCY EXAMINATIONS.**  
> While the CodeSkill codebase demonstrates sophisticated domain features—including sharded submissions, declarative monthly PostgreSQL partitioning, automated proctoring with facial verification, and multi-tenant role isolation—the audit team uncovered **2 Critical Deficiencies** and **6 High-Severity Architectural Hazards** that will trigger catastrophic student lockouts, cloud infrastructure compromise, or cascading database outages under concurrent examination workloads.

The platform cannot safely support scheduled high-stakes university or corporate examinations (500 to 2,000+ concurrent students) without immediate remediation of the blockers detailed below.

---

## 2. Key Metrics Summary

| Metric Dimension | Value | Reference / Verification Note |
|---|---|---|
| **Repository Commit Audited** | `7c83df6ef13915c1171dd4b3e61f31a0c24306e2` | Verified via `git rev-parse HEAD` |
| **Backend Modules Inventoried / Assessed** | 29 / 29 (100%) | `backend-nestjs/src/**/*.module.ts` |
| **Backend REST & WebSocket Controllers** | 29 Controllers / 1 Gateway | Full traversal of NestJS routing tree |
| **Backend API Endpoints Enumerate & Audited** | 186 unique endpoints | Static AST analysis of HTTP decorators |
| **Frontend Page Routes & Layouts** | 92 Pages / 5 Layouts / 5 Route Handlers | `frontend-v2/src/app` Next.js App Router |
| **Frontend Reusable Components / Hooks** | 133 Components / 12 Custom Hooks | `frontend-v2/src/{components,hooks}` |
| **Database Entities / Migrations** | 32 TypeORM Entities / 11 Migrations | `backend-nestjs/src/database/{entities,migrations}` |
| **Automated Unit Suites Executed** | 119 Suites (72 Backend + 47 Frontend) | `npm test` across both workspaces |
| **Automated Unit Tests Passing** | 945 Passed, 9 Skipped, 0 Failed | 100% pass rate of existing unit tests |
| **Total Issues Identified** | **26 Discrete Issues** | Documented in `03_COMPLETE_ISSUE_REGISTER.md` |
| **Critical Severity Defects** | **2 Issues** | Infrastructure compromise & permanent student lockout |
| **High Severity Defects** | **9 Issues** | Concurrency races, connection exhaustion, startup DDL deadlocks, IAM wildcard, OOM |
| **Medium Severity Defects** | **11 Issues** | WAF omission, S3 co-mingling, NAT SSR routing, Cloud Map orphans, supply chain CVEs |
| **Low / Informational Findings** | **4 Issues** | Mutable tags, missing CloudWatch alarms, telemetry fail-open, test gating |

---

## 3. Critical Release Blockers

### Blocker 1: Piston Sandbox Container Runs Privileged Without Network Isolation in Terraform Production Userdata (ISSUE-SEC-001)
- **Classification:** CONFIRMED
- **Severity / CVSS:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H — Score: 9.9)
- **Location:** `terraform/environments/production/userdata/piston.sh.tftpl:57-61` and `terraform/modules/ec2-asg/main.tf:28`
- **Mechanism:** In the production Terraform launch script, the Piston Docker container is executed with `--privileged` and omitted the required environment variable `-e PISTON_DISABLE_NETWORKING=true`. Concurrently, the EC2 Launch Template configures `http_put_response_hop_limit = 2`.
- **Impact:** Any authenticated user or student submitting code in languages supported by Piston (Python, C++, JS, Bash) can initiate outbound socket connections from the sandbox container, query the AWS Instance Metadata Service (IMDSv2 at `169.254.169.254`), and exfiltrate IAM role credentials attached to `codeskill-piston-asg`, leading to complete AWS account and infrastructure compromise.

### Blocker 2: Permanent Student Deadlock in `'evaluating'` State Machine Upon Network Timeout or Transient Error (ISSUE-DAT-001 / ISSUE-FE-001)
- **Classification:** CONFIRMED
- **Severity:** CRITICAL
- **Location:** `backend-nestjs/src/assessments/assessments.service.ts:1728-1751` & `frontend-v2/src/app/assessments/[id]/take/page.tsx:403-415`
- **Mechanism:** During assessment submission, `evaluateAttempt` executes a compare-and-swap (CAS) transition from `in_progress` to `evaluating`. However, the synchronous code execution loop that follows is not enclosed in a recovery block that clears or reverts the status upon timeout or failure. If Nginx triggers a 504 Gateway Timeout (120s limit) or Piston temporarily fails, the attempt status is left permanently recorded as `'evaluating'` in the database. When the student attempts to retry (either via the frontend auto-retry loop or manually), line 1728 intercepts the request and throws an HTTP 409 Conflict (`Assessment submission is currently being evaluated. Please wait.`).
- **Impact:** The student is permanently locked out of submitting their examination attempt, resulting in catastrophic exam failure and zero marks recorded.

---

## 4. High-Risk Architectural Weaknesses

1. **Synchronous In-Band Code Execution During Assessment Submission (ISSUE-PRF-001):**
   Unlike contests (which queue submissions to BullMQ), `POST /api/assessments/:id/submit` executes every test case of every coding question sequentially on the NestJS API process using `ExecutionService.runCode()`. Under an exam conclusion wave where 500 students submit simultaneously, 500 requests each execute 10-30 test cases, demanding over 7,500 executions on a single Piston host capable of ~16 executions/sec. Every request exceeds the Nginx 120-second `proxy_read_timeout`, triggering widespread 504 Gateway Timeouts.

2. **PgBouncer Absence & Database Connection Pool Saturation (ISSUE-INF-001):**
   `terraform/modules/rds/main.tf` configures `max_connections = 200` on a `db.t3.medium` PostgreSQL RDS instance, with code comments claiming PgBouncer pooling is active. However, **no PgBouncer or RDS Proxy instance is provisioned**. The backend NestJS pool configures `DB_POOL_MAX = 50` per process. At baseline scale (2 EC2 instances running 2-3 PM2 processes), the maximum connection demand is $2 \times 3 \times 50 = 300$, immediately exhausting RDS capacity and causing PostgreSQL to reject connections with `FATAL: sorry, too many clients already`.

3. **Redis Reconnection Failure on Failover (`retryStrategy` Returns `null`) (ISSUE-RES-001):**
   `backend-nestjs/src/redis/redis.service.ts:20-24` defines an aggressive retry policy: `if (times > 3) return null;`. In `ioredis`, returning `null` permanently closes the client and emits an `end` event. If an ElastiCache node failover or network blip lasts longer than 600ms (3 retries with 100ms-300ms delays), the Redis client permanently terminates. All OTP verifications, smart rate-limiting, and execution admissions immediately crash until the NestJS application is manually restarted.

4. **Non-Transactional Contest Reattempt Grant Race Condition (ISSUE-CON-001):**
   `backend-nestjs/src/contests/contests.service.ts:351-388` checks active reattempt grants, increments `grant.usedAttempts`, and creates a new `ContestAttempt` row without a database transaction or row-level lock. Concurrent duplicate calls read `usedAttempts = 0`, increment in memory, and attempt to insert identical `attemptNumber = 2` rows. The second insert crashes with a database unique constraint violation, while the grant counter is permanently consumed without an attempt being granted.

5. **SQL LIKE Wildcard Ambiguity in User Authentication (ISSUE-SEC-002):**
   `backend-nestjs/src/auth/auth.service.ts:107-114` looks up users during login using `{ email: ILike(raw) }, { name: ILike(raw) }, { email: ILike(`${raw}@%`) }`. Wildcards (`%`, `_`) are unescaped, and lookup by `name` is permitted without uniqueness constraints. An input of `%` or a common first name matches arbitrary records, allowing credential stuffing across ambiguous accounts.

6. **Synchronous Bcrypt Event-Loop Starvation in Bulk Student Import (ISSUE-PRF-002):**
   `backend-nestjs/src/students/students.service.ts:736-742` iterates over imported rows executing `await bcrypt.hash(rawPassword, salt)` sequentially on the main Node.js threadpool. An import of 2,000 students occupies the libuv threadpool for over 200 seconds, causing Nginx 504 timeouts, stalling health check probes, and causing ASG health check failures that lead to instance termination.

---

## 5. Capacity and Scalability Baseline

| Concurrency Tier | Active Concurrent Users | Feasibility Under Current Architecture | Primary Bottleneck |
|---|---|---|---|
| **Very Small (10)** | 10 | **VIABLE** | None |
| **Small (50)** | 50 | **VIABLE** | None |
| **Moderate (100)** | 100 | **MARGINAL RISK** | Piston queue latency during simultaneous submit |
| **Growing (500)** | 500 | **UNVIABLE (Critical Outage)** | Synchronous code execution timeout; RDS pool saturation |
| **Large (1,000)** | 1,000 | **UNVIABLE (Catastrophic)** | Nginx 504 timeouts; event loop starvation; RDS connection drop |
| **High Load (5,000+)** | 5,000+ | **UNVIABLE (Immediate Collapse)** | Database locks; Redis single-shard queue saturation; ASG limits |

---

## 6. Audit Deliverables Index

All 14 comprehensive audit reports have been compiled independently into the `engineering-audit/` directory:

1. [`01_EXECUTIVE_SUMMARY.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/01_EXECUTIVE_SUMMARY.md) — Pre-production readiness assessment and executive briefing.
2. [`02_ARCHITECTURE_ANALYSIS.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/02_ARCHITECTURE_ANALYSIS.md) — Reconstructed system topology, service boundaries, single points of failure, and 9 Mermaid architecture diagrams.
3. [`03_COMPLETE_ISSUE_REGISTER.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/03_COMPLETE_ISSUE_REGISTER.md) — Exhaustive catalog of all 18 discovered issues with file locations, evidence, root causes, impacts, and remediation plans.
4. [`04_SECURITY_ASSESSMENT.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/04_SECURITY_ASSESSMENT.md) — Threat modeling, OWASP ASVS Level 2/3 gap analysis, sandbox escape vectors, and auth boundaries.
5. [`05_PERFORMANCE_AND_CAPACITY.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/05_PERFORMANCE_AND_CAPACITY.md) — Mathematical capacity models (Little's Law, CPU demand, connection limits) across 9 concurrency tiers.
6. [`06_CONCURRENCY_AND_DATA_INTEGRITY.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/06_CONCURRENCY_AND_DATA_INTEGRITY.md) — Race conditions, transaction atomicity, distributed locks, and state machine transitions.
7. [`07_DATABASE_AUDIT.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/07_DATABASE_AUDIT.md) — Declarative partitioning analysis, sharding cross-database consistency, N+1 queries, and connection pool sizing.
8. [`08_FRONTEND_AUDIT.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/08_FRONTEND_AUDIT.md) — Next.js App Router performance, retry desynchronization, webcam memory leaks, and WCAG accessibility gaps.
9. [`09_INFRASTRUCTURE_AND_RELIABILITY.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/09_INFRASTRUCTURE_AND_RELIABILITY.md) — Terraform IaC review, Auto Scaling instance refresh deadlocks, FMEA analysis, and single points of failure.
10. [`10_TEST_COVERAGE_AND_GAPS.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/10_TEST_COVERAGE_AND_GAPS.md) — Quality architecture review, test quality evaluation, and prioritized missing regression test matrix.
11. [`11_DEPENDENCY_AND_SUPPLY_CHAIN.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/11_DEPENDENCY_AND_SUPPLY_CHAIN.md) — Bill of Materials (SBOM), vulnerable packages (`xlsx 0.18.5`), and supply chain risks.
12. [`12_REMEDIATION_PRIORITY.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/12_REMEDIATION_PRIORITY.md) — Dependency-ordered implementation roadmap with complexity, regression risk, and verification criteria.
13. [`13_AUDIT_COVERAGE_MATRIX.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/13_AUDIT_COVERAGE_MATRIX.md) — Traceable coverage matrix across all 29 modules, 186 endpoints, and infrastructure components.
14. [`14_EVIDENCE_AND_REPRODUCTION.md`](file:///Users/venkateshk22/Documents/codeskill/engineering-audit/14_EVIDENCE_AND_REPRODUCTION.md) — Concrete reproduction commands, logs, configuration traces, and sanitised evidence.
