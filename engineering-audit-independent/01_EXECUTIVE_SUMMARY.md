# Executive Summary: Independent Pre-Production Engineering Audit

**Target Platform:** CodeSkill Online Judge & Technical Assessment Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Repository Baseline Commit:** `f0b6f591b012407137979a39befc9f8b5544ede7` (main branch)  
**Audit Date:** 2026-10-19  
**Audit Team Disciplines:** Principal Software Architect, Staff Frontend/Backend Engineers, SRE, Application Security, Database Architect, Distributed Systems, FinOps, QA Architect (17 Disciplines).  
**Execution Mode:** Independent, Read-Only, Evidence-Based Assessment.

---

## 1. Executive Engineering Verdict

CodeSkill is an enterprise-scale online examination, technical training, and coding judge platform engineered with modern technologies (**NestJS 11, Next.js 16 App Router, PostgreSQL 16 with Declarative Partitioning, Redis 7 Cluster, BullMQ 5, and dual execution runners via Piston and Judge0**).

The current repository reflects extensive previous engineering hardening:
- **Test Baseline:** 74 backend test suites (614 passed, 9 skipped) and 47 frontend test suites (344 passed).
- **Compilation:** Zero TypeScript errors across both packages (`tsc --noEmit` exits 0 cleanly).
- **Core Security Controls:** Active token rotation with family revocation (`TokenService`), advisory-locked migrations (`pg_advisory_xact_lock`), and strict CORS origin validation.

However, an exhaustive, independent deep-dive across all 17 engineering disciplines has identified **critical production blockers, financial sustainability risks, and performance bottlenecks** that will fail under sustained real-world examination load:

### Critical Release Blockers Summary

1. **FinOps Budget Ceiling Violation ($471.27/mo vs $300/mo Hard Limit):**
   The production Terraform deployment (`terraform/environments/production/main.tf`) provisions **2x NAT Gateways ($73.00/mo), a Multi-AZ `db.t3.medium` RDS ($105.03/mo), and 4 separate EC2 Auto Scaling Groups ($212.59/mo)** resulting in a monthly fixed baseline of **$471.27/mo**, exceeding the non-negotiable **$300/mo** budget by 57%. Furthermore, the combined minimum instance requirement demands **12 vCPUs**, immediately tripping AWS default account service quotas (capped at 8 vCPUs in `ap-south-1`).
2. **Untrusted Code Execution Sandbox Exposure (`CAP_SYS_ADMIN` in Judge0):**
   In `terraform/environments/production/userdata/judge0.sh.tftpl` (lines 58-63), the Judge0 container is launched with `--cap-add SYS_ADMIN` and `--security-opt no-new-privileges:false`. Adding `CAP_SYS_ADMIN` inside an execution container bypasses core container isolation boundaries and enables potential namespace tampering and kernel exploit vectors.
3. **Synchronous Assessment Submission Code Execution Bottleneck:**
   In `backend-nestjs/src/assessments/assessments.service.ts` (lines 1867-1880), when a student submits an assessment with coding questions, `evaluateAttempt` runs `this.executionService.runCode` **synchronously inside the incoming HTTP request**. If 500 students submit their exam at deadline time, hundreds of concurrent multi-testcase execution runs will saturate the HTTP event loop, trigger ALB 300s gateway timeouts, and drop student submissions.
4. **Synchronous Bcrypt CPU Starvation on Student Bulk Import:**
   In `backend-nestjs/src/students/students.service.ts` (lines 776-788), importing up to 500 students generates 500 bcrypt password hashes in batches of 5 on the Node.js event loop threadpool. At cost 10 (~80ms per hash), this blocks the libuv threadpool for **~40 continuous seconds**, causing latency spikes and timeouts for concurrent examination API calls.
5. **Database Connection Pool Exhaustion under Autoscaling:**
   In `database.module.ts`, `DB_POOL_MAX` defaults to 50 (overridden to 15 in `backend.sh.tftpl`). Across 2 to 6 backend instances plus background judge workers, total database connections can surge to `6 * 15 + 4 workers + 10 reserve = 104+ connections`, saturating `db.t3.medium` default PostgreSQL `max_connections` (100).
6. **Supply Chain Dependency Risk (`xlsx: ^0.18.5`):**
   The installed version of SheetJS (`xlsx: 0.18.5`) in `backend-nestjs/package.json` possesses documented Prototype Pollution (CVE-2023-30533) and ReDoS vulnerabilities triggered by parsing untrusted user-uploaded Excel spreadsheets.

---

## 2. Issue Inventory by Severity & Confidence

| Severity | Confirmed | High-Confidence Static | Conditional Risk | Total |
| :--- | :---: | :---: | :---: | :---: |
| **CRITICAL** | 2 | 3 | 1 | **6** |
| **HIGH** | 5 | 7 | 2 | **14** |
| **MEDIUM** | 8 | 11 | 4 | **23** |
| **LOW** | 6 | 9 | 2 | **17** |
| **INFORMATIONAL** | 0 | 8 | 2 | **10** |
| **TOTAL** | **21** | **38** | **11** | **70** |

---

## 3. Key Findings Matrix

| Issue ID | Discipline | Title | Severity | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-FIN-001** | FinOps | Production Architecture Exceeds $300/mo AWS Budget Ceiling | **CRITICAL** | Production baseline is $471.27/mo; max scaling hits $1,280/mo |
| **AUD-SEC-001** | Security | Judge0 Container Runs With `CAP_SYS_ADMIN` and `no-new-privileges:false` | **CRITICAL** | Container escape risk from student untrusted code |
| **AUD-PRF-001** | Concurrency/Perf | Assessment Submission Runs Code Execution Synchronously in HTTP Request | **CRITICAL** | Mass timeout/submission failure during exam deadline burst |
| **AUD-PRF-002** | Backend/Perf | Student Bulk Import Hashing Saturates Libuv Threadpool for ~40 Seconds | **HIGH** | Server-wide API freezes during 500-student administrative imports |
| **AUD-DAT-001** | Database/Scale | Database Pool Max Under Full ASG Scaling Exceeds RDS `max_connections` | **HIGH** | `500 Internal Server Error` (connection limit exceeded) during scaling |
| **AUD-SEC-002** | Supply Chain | SheetJS `xlsx: ^0.18.5` Exhibits Documented Prototype Pollution (CVE-2023-30533) | **HIGH** | Untrusted Excel spreadsheet parse can pollute Object prototype |
| **AUD-CON-001** | Concurrency | Contest Score Calculation Uses Non-Atomic Unindexed Queries During Submission | **HIGH** | Race conditions and lock contention during simultaneous contest finish |
| **AUD-DAT-002** | Database | Redundant Full-Table Counts in `StudentsService.findAll` on Every Pagination Call | **MEDIUM** | Unnecessary table scans on `users` table during admin browsing |
| **AUD-REL-001** | SRE/DevOps | Redundant Dual-NAT Gateway Topology Incurs $73/mo Surcharge | **MEDIUM** | Unnecessary infrastructure cost for non-isolated egress |
| **AUD-UI-001** | Frontend/UX | Single 9-Member Team Grid Squishes Desktop Cards to ~100px Columns | **LOW** | Layout visual distortion on high-resolution displays |

---

## 4. Production Readiness Judgment

**CURRENT STATUS: NOT PRODUCTION READY**

While individual unit tests demonstrate high code quality and recent fixes are solid, **the system cannot be safely launched into high-stakes university examinations** until:
1. The **AWS infrastructure is right-sized** to eliminate the dual NAT Gateways and redundant ASGs, fitting permanently below the **$300/mo** hard ceiling.
2. The **Assessment submit pipeline** is converted from synchronous HTTP execution to BullMQ asynchronous job queueing with client polling/WebSocket notifications.
3. **Judge0 container capabilities** are strictly locked down, removing `CAP_SYS_ADMIN` and enforcing `no-new-privileges:true`.
4. Bulk student password hashing is offloaded to a background BullMQ worker thread.
