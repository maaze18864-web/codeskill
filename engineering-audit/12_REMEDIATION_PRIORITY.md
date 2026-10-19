# 12. Engineering Remediation Priority, Dependency Graph, and Implementation Roadmap

**Audit Target:** CodeSkill Full-Stack Examination Platform  
**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Discipline Lead:** Principal Software Architect, SRE & QA Lead  
**Status:** COMPLETE & INDEPENDENTLY VERIFIED  

---

## 1. Executive Summary: Prioritized Engineering Roadmap

A pre-production audit is only as valuable as the clarity and rigor of its remediation plan. Attempting to fix issues haphazardly without understanding cross-system dependencies risks introducing severe secondary regressions—such as increasing backend connection limits without a connection pooler or refactoring frontend retry logic before fixing the backend state machine.

This document establishes a **strict 4-phase, risk-ranked remediation roadmap** covering all 18 cataloged vulnerabilities.

```mermaid
graph TD
    subgraph Phase 1: Pre-Production Blockers (Days 1-5)
        SEC01[ISSUE-SEC-001: Piston Sandbox Isolation]
        INF01[ISSUE-INF-001: AWS RDS Proxy / PgBouncer]
        RES01[ISSUE-RES-001: Redis Reconnect Strategy]
        PRF01[ISSUE-PRF-001: BullMQ Async Assessment Grading]
        DAT01[ISSUE-DAT-001: Assessment CAS Lease & Compensation]
    end

    subgraph Phase 2: High Integrity & Auth Safeguards (Days 6-10)
        CON01[ISSUE-CON-001: Contest Grant Transaction Locks]
        SEC02[ISSUE-SEC-002: Escape ILike User Search]
        FE01[ISSUE-FE-001: Frontend 409 Retry Alignment]
        PRF02[ISSUE-PRF-002: Worker Offload for Student Bcrypt]
        SEC03[ISSUE-SEC-003: Enable Express Trust Proxy]
        SEC04[ISSUE-SEC-004: Enable ElastiCache Encryption]
    end

    subgraph Phase 3: Scalability & Memory Hygiene (Days 11-17)
        DAT02[ISSUE-DAT-002: Keyset Pagination for Shards]
        SEC05[ISSUE-SEC-005: Replace xlsx with exceljs]
        DAT03[ISSUE-DAT-003: Batch Report Queries & PDF Worker]
        FE02[ISSUE-FE-002: Guaranteed Media Teardown]
        INF02[ISSUE-INF-002: Remove ALB Backend Stickiness]
    end

    subgraph Phase 4: Operational Resilience & Quality Gates (Days 18-22)
        OBS01[ISSUE-OBS-001: Axiom Logging Safe Rejection]
        QA01[ISSUE-QA-001: Gate Concurrency & Shards in CI]
    end

    INF01 --> PRF01
    PRF01 --> DAT01
    DAT01 --> FE01
    SEC01 --> QA01
```

---

## 2. Remediation Dependency Matrix

Before deploying changes, engineering teams must observe the following prerequisite relationships:

| Target Fix | Prerequisite Tasks | Why Order Matters |
| :--- | :--- | :--- |
| **`ISSUE-PRF-001` (Async Grading)** | `ISSUE-INF-001` (RDS Proxy) | Asynchronous grading queues submissions in BullMQ, which spikes worker database connections upon batch drains. |
| **`ISSUE-DAT-001` (CAS Lease)** | Database Migration for `evaluatingStartedAt` | State machine query requires the new column and index to be applied to PostgreSQL first. |
| **`ISSUE-FE-001` (Frontend Retry)** | `ISSUE-DAT-001` (Backend CAS) | Frontend cannot poll/retry safely until backend implements idempotent result retrieval. |
| **`ISSUE-FE-002` (Media Teardown)** | `ISSUE-FE-001` (Frontend Retry) | Media cleanup must hook into the unified submission lifecycle state. |
| **`ISSUE-INF-002` (ALB Stickiness)** | None | Can be updated directly via Terraform. |

---

## 3. Detailed Issue Implementation Register

| Issue ID | Severity | Remediation Scope | Est. Dev Days | Complexity | Regression Risk | Key Verification Test |
| :--- | :--- | :--- | :-: | :-: | :-: | :--- |
| **ISSUE-SEC-001** | CRITICAL | Remove `--privileged` in Piston userdata; drop IMDSv2 hop limit to 1. | 1.0 | Medium | Low | Run unshare/mount test inside Piston; verify 169.254.169.254 unreachable. |
| **ISSUE-DAT-001** | CRITICAL | Add 5-minute lease and `try/catch` rollback to `AssessmentsService`. | 2.0 | Medium | Medium | Inject Piston failure during submit; verify attempt returns to `in_progress`. |
| **ISSUE-PRF-001** | HIGH | Transition assessment submission to BullMQ worker queue. | 3.0 | High | High | Run 500-submission burst test; verify zero ALB 504 timeouts. |
| **ISSUE-INF-001** | HIGH | Deploy AWS RDS Proxy via Terraform; configure `max_connections=500`. | 1.5 | Medium | Low | Scale backend ASG to 6 instances; verify zero connection rejected errors. |
| **ISSUE-RES-001** | HIGH | Update `RedisService.retryStrategy` to exponential backoff without exit. | 0.5 | Low | Low | Restart Redis container locally; verify backend auto-reconnects. |
| **ISSUE-CON-001** | HIGH | Enclose contest reattempt grant check in pessimistic row transaction. | 1.5 | Medium | Medium | Run 20 concurrent start calls; verify exactly 1 attempt created without crashes. |
| **ISSUE-SEC-002** | HIGH | Sanitize SQL LIKE inputs (`%`, `_`); enforce exact match on username. | 0.5 | Low | Low | Submit `%` to `/api/auth/login`; verify it does not match first user. |
| **ISSUE-FE-001** | HIGH | Treat HTTP 409 as transient with exponential backoff in take page. | 1.0 | Low | Low | Mock 409 backend response; verify client polls until scorecard is ready. |
| **ISSUE-PRF-002** | HIGH | Offload batch CSV student import and bcrypt hashing to BullMQ job. | 2.0 | Medium | Medium | Import 2,000 students; verify event loop latency remains under 50ms. |
| **ISSUE-SEC-003** | MEDIUM | Set `app.set('trust proxy', true)` in NestJS Express configuration. | 0.2 | Low | Low | Send spoofed `X-Forwarded-For`; verify throttler uses actual client IP. |
| **ISSUE-SEC-004** | MEDIUM | Enable in-transit and at-rest encryption in Terraform ElastiCache module. | 0.5 | Low | Medium | Re-apply Terraform; verify Redis TLS connection string handshakes. |
| **ISSUE-DAT-002** | MEDIUM | Rewrite `SubmissionStore.findManyCrossShard` to use keyset cursor pagination. | 2.5 | High | Medium | Query page 100 with 10k rows; verify heap memory delta < 10MB. |
| **ISSUE-SEC-005** | MEDIUM | Replace `xlsx` with `exceljs` across student import routines. | 1.5 | Medium | Low | Import standard and malformed .xlsx files; verify clean parsing without CVEs. |
| **ISSUE-DAT-003** | MEDIUM | Batch report database queries; offload PDF generation to background worker. | 2.0 | Medium | Medium | Generate 300-student report; verify zero main thread blocking. |
| **ISSUE-FE-002** | MEDIUM | Place `stopCamera()` and MediaPipe cleanup in `finally` block. | 0.5 | Low | Low | Induce submit failure; verify camera LED extinguishes and tracks stop. |
| **ISSUE-INF-002** | MEDIUM | Disable `stickiness` on ALB backend target group in Terraform. | 0.2 | Low | Low | Execute ASG instance refresh; verify active WebSocket clients rebalance. |
| **ISSUE-INF-003** | HIGH | Remove startup migration runner from backend ASG user-data template. | 0.5 | Low | Low | Scale ASG to 4 nodes; verify all instances boot without DDL deadlocks. |
| **ISSUE-INF-004** | HIGH | Restrict backend IAM `app_secrets` policy from `*` to specific secret ARNs. | 0.5 | Low | Low | Verify backend reads app secrets but cannot read unrelated AWS secrets. |
| **ISSUE-INF-005** | MEDIUM | Associate `modules/waf` with production ALB in `production/main.tf`. | 0.5 | Low | Low | Send OWASP test probe; verify WAF blocks Layer 7 SQLi/XSS requests. |
| **ISSUE-INF-006** | MEDIUM | Enable S3 KMS encryption and separate public avatars from private reports. | 1.0 | Medium | Low | Verify reports require presigned URLs and stored objects are KMS encrypted. |
| **ISSUE-INF-007** | MEDIUM | Route Next.js `INTERNAL_BACKEND_URL` to internal VPC DNS or private ALB. | 0.5 | Low | Low | Verify SSR calls bypass NAT Gateway; monitor NAT processing cost reduction. |
| **ISSUE-INF-008** | MEDIUM | Wire Cloud Map deregistration script to systemd `shutdown.target`. | 0.5 | Low | Low | Terminate Piston instance; verify IP is removed from Cloud Map DNS within 15s. |
| **ISSUE-INF-009** | LOW | Enforce immutable Git commit SHA image tags instead of `:latest`. | 0.5 | Low | Low | Verify ASG launch templates pin exact immutable image digests. |
| **ISSUE-INF-010** | LOW | Provision AWS CloudWatch alarms for RDS, ALB 5XX, and ElastiCache. | 1.0 | Low | Low | Trigger synthetic alarm test; verify SNS alerts arrive to ops email. |
| **ISSUE-OBS-001** | LOW | Attach `.catch()` to `this.axiom.ingest` Promise in Winston transport. | 0.2 | Low | Low | Invalidate Axiom token; verify no unhandled rejection crashes occur. |
| **ISSUE-QA-001** | LOW | Add shard integration and concurrency test suites to GitHub Actions. | 1.5 | Medium | Low | Verify CI pipeline runs all automated suites and gates PR merges. |

---

## 4. Phase-by-Phase Execution Schedule

### Phase 1: Security & Stability Blockers (Target: Week 1)
* **Goal:** Eliminate container escape vulnerabilities and prevent catastrophic examination downtime.
* **Deliverables:**
  * Patch Terraform Piston userdata and EC2 launch template.
  * Provision AWS RDS Proxy to support backend horizontal autoscaling.
  * Add automatic Redis reconnect loop.
  * Implement BullMQ asynchronous code grading for assessment submissions.
  * Implement CAS expiration lease and compensation rollback in `AssessmentsService`.

### Phase 2: Data Integrity & Access Control (Target: Week 2)
* **Goal:** Guarantee transactional consistency and harden authentication against enumeration and rate-limit bypass.
* **Deliverables:**
  * Add pessimistic transaction locking to `ContestsService.startContest`.
  * Sanitize `ILIKE` wildcard queries in `AuthService`.
  * Align frontend submission retry loop with backend CAS state machine.
  * Offload batch bcrypt hashing to background workers.
  * Enable Express `trust proxy` and ElastiCache Redis encryption.

### Phase 3: Scalability, Memory Hygiene & Third-Party Audit (Target: Weeks 3-4)
* **Goal:** Prevent memory exhaustion under deep pagination, remove vulnerable dependencies, and optimize client runtime.
* **Deliverables:**
  * Implement keyset pagination in `SubmissionStore`.
  * Migrate from `xlsx` to `exceljs`.
  * Guarantee frontend camera, audio, and WebAssembly teardown in `finally` block.
  * Disable ALB cookie stickiness on backend API target group.
  * Optimize assessment report queries and PDF generation.

### Phase 4: Operational Resilience & Automated CI Gates (Target: Ongoing)
* **Goal:** Protect production through automated continuous integration gating and resilient telemetry.
* **Deliverables:**
  * Attach safe error handlers to Axiom Winston transport.
  * Gate shard integration tests and concurrency tests in `.github/workflows/deploy.yml`.
  * Modernize E2E tests to match global response interceptor.
