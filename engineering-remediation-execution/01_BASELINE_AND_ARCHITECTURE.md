# 01 — Baseline & Architecture Specification

## 1. Executive Summary & Git Baseline
- **Starting Git Commit**: `c8965f5d4897b472f0b411e0b34da05c6a5fb468`
- **Remediation Branch**: `remediation/full-stack-fixes`
- **Baseline Test Suite Status**:
  - Backend (`backend-nestjs`): 72 test suites, 610 total tests (601 passed, 9 skipped, 0 failed).
  - Frontend (`frontend-v2`): 47 test suites, 344 total tests (344 passed, 0 failed).
  - TypeScript Compilation: 0 errors on both packages (`tsc --noEmit`).
- **Core Business Invariants**:
  1. Student examination submissions must be durable, idempotent, and protected against data loss.
  2. Untrusted code execution must be strictly isolated (no root/privileged container access, no AWS IMDS access, no local file or network compromise).
  3. Assessment and contest grading integrity must be deterministic and guarded against race conditions.
  4. The platform must remain strictly within a **$300 USD / month recurring AWS budget** under standard operating workloads (up to 5,000 active students, 200 concurrent submissions/min peak).

---

## 2. System Architecture Overview

CodeSkill is a multi-tier technical assessment and competitive programming platform architected as follows:

```
[ Client Browser (Next.js 15 App Router) ]
                |  HTTPS / WSS
                v
[ AWS Application Load Balancer (ALB) + AWS WAF ]
                |
       +--------+--------+
       |                 |
       v                 v
[ Next.js SSR ]   [ NestJS Backend API (ASG) ]
  (Port 3000)       (Port 5001)
                         |
       +-----------------+-----------------+-----------------+
       |                 |                 |                 |
       v                 v                 v                 v
[ Primary PostgreSQL ] [ Shard DBs ] [ Redis / BullMQ ] [ Piston / Judge0 ASG ]
  (RDS db.t4g.micro)    (Optional)     (ElastiCache)     (Isolated t4g.small)
```

### 2.1 Backend (`backend-nestjs`)
- **Framework**: NestJS 11 with TypeScript.
- **Data Tier**: PostgreSQL with TypeORM.
- **Queue & Async Processing**: BullMQ backed by Redis for asynchronous submission grading, worker tasks, and socket event broadcasting.
- **Execution Engine**: Dual-mode execution engine supporting Piston and Judge0 through language-specific runners.
- **Authentication**: JWT access tokens (short-lived) + hashed refresh tokens stored in database, OTP verification in Redis.

### 2.2 Frontend (`frontend-v2`)
- **Framework**: Next.js 15 App Router with React 19.
- **State Management**: Zustand and React Context.
- **Code Editor**: Monaco Editor integration with multi-language syntax highlighting and test execution runner.
- **Proctoring**: Client-side media stream capture and MediaPipe WASM model for gaze and face tracking during proctored exams.

### 2.3 Cloud Infrastructure (`terraform/`)
- **Environments**: Dev, Production, and Judges modules.
- **Compute**: Autoscaling groups for Backend API, Next.js Frontend, and Execution Judges (Piston/Judge0).
- **Networking**: VPC across 2 Availability Zones with public/private subnets, Internet Gateway, and NAT Gateway.
- **Data Stores**: AWS RDS PostgreSQL (Single-AZ `db.t4g.micro` with gp3 storage) and AWS ElastiCache Redis (`cache.t4g.micro`).
- **Security & Storage**: S3 buckets for proctoring snapshots/reports and user avatars, AWS WAF on ALB, IAM roles with least privilege.

---

## 3. Financial Ceiling: $300/Month AWS Recurring Budget

| Resource | Configuration | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **Compute (Backend ASG)** | 1x `t4g.small` (On-Demand baseline) + 1-2 Spot scale | $12.26 (OD) + $4.50 (Spot) = ~$16.76 |
| **Compute (Frontend ASG)** | 1x `t4g.small` (On-Demand baseline) + 1-2 Spot scale | $12.26 (OD) + $4.50 (Spot) = ~$16.76 |
| **Compute (Judges ASG)** | 1x `t4g.small` (Spot execution workers, 0-3 autoscaled) | ~$5.00 - $12.00 |
| **Database (RDS PostgreSQL)** | 1x `db.t4g.micro` Single-AZ + 20 GB gp3 storage | ~$14.50 + $2.30 = ~$16.80 |
| **Caching (ElastiCache Redis)** | 1x `cache.t4g.micro` Single-AZ | ~$13.00 |
| **Networking (NAT Gateway)** | 1x Single-AZ NAT Gateway (~100 GB traffic) | $32.40 (Hourly) + $4.50 (Data) = ~$36.90 |
| **Load Balancing (ALB)** | 1x Application Load Balancer (~15 LCU-hours/mo) | $16.20 + $4.50 = ~$20.70 |
| **Storage (S3 + Glacier Lifecycle)** | Standard storage (< 50 GB) + lifecycle transitions | ~$2.50 |
| **WAF & Shield Standard** | 1 Web ACL + 3 managed rule sets (rate-limit, common, bad inputs) | $5.00 + $3.00 = ~$8.00 |
| **CloudWatch & Telemetry** | Alarms (10) + Metrics + Logs (7-day retention) | ~$6.00 |
| **Contingency / Traffic Buffer** | Egress bandwidth + Spot spikes | ~$85.00 |
| **TOTAL ESTIMATED MONTHLY SPEND** | **Target Baseline: ~$150 - $220 / month** | **<= $300.00 / month (HARD CAP)** |

---

## 4. Reconciled Issue Inventory & Sprint Schedule

| Sprint | Focus Area | Issues Addressed | Target Gate |
| :--- | :--- | :--- | :--- |
| **Sprint A** | Execution Sandbox Isolation & IAM | `ISSUE-SEC-001`, `ISSUE-INF-004` | Gate G0 |
| **Sprint B** | Durable Assessment Submissions & Async Grading | `ISSUE-DAT-001`, `ISSUE-PRF-001`, `ISSUE-FE-001` | Gate G1 |
| **Sprint C** | Concurrency, Database Pooling & Redis Resilience | `ISSUE-CON-001`, `ISSUE-INF-001`, `ISSUE-RES-001`, `ISSUE-INF-003` | Gate G2 |
| **Sprint D** | Auth Security, Rate Limiting & Network Isolation | `ISSUE-SEC-002`, `ISSUE-SEC-003`, `ISSUE-SEC-004`, `ISSUE-INF-002`, `ISSUE-INF-005`, `ISSUE-INF-007` | Gate G3 |
| **Sprint E** | Sharding Scalability, Report Worker & Dependency Cleanup | `ISSUE-DAT-002`, `ISSUE-DAT-003`, `ISSUE-PRF-002`, `ISSUE-SEC-005` | Gate G4 |
| **Sprint F** | Frontend Lifecycle, Telemetry & CI Hardening | `ISSUE-FE-002`, `ISSUE-INF-006`, `ISSUE-INF-008`, `ISSUE-INF-009`, `ISSUE-INF-010`, `ISSUE-OBS-001`, `ISSUE-QA-001` | Gate G5 |
| **Final** | Verification, Concurrency & Security Testing | Full Test Runs & Documentation Verification | Gate G6 |
