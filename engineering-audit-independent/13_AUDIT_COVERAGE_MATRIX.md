# Comprehensive Audit Coverage Matrix

**Platform:** CodeSkill Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** QA Architect & Compliance Lead  
**Audit Scope:** 29 Backend Controllers, 33 Database Entities, 98 Frontend Routes, 4 AWS ASGs, 2 Execution Engines

---

## Component-Level Audit Disposition

| Module / Subsystem | Path / Component | Static Review | Dynamic Test | Security Review | Concurrency Review | Performance Review | Overall Disposition | Evidence Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Auth & Tokens** | `backend-nestjs/src/auth/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `auth.security.spec.ts`, `token.service.spec.ts` |
| **Assessments API** | `backend-nestjs/src/assessments/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `assessments.service.ts` (AUD-PRF-001) |
| **Contests & Timing** | `backend-nestjs/src/contests/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `contests.service.spec.ts` (AUD-CON-001) |
| **Execution Controller** | `backend-nestjs/src/execution/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `execution.controller.ts`, admission queue |
| **Judge Processor** | `src/execution/judge.processor.ts` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | BullMQ worker tests, heartbeat lease |
| **Piston Runner** | `deployment/piston/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `piston.service.spec.ts`, compose.yaml |
| **Judge0 Runner** | `terraform/.../judge0.sh.tftpl` | VERIFIED | BLOCKED (Idle) | VERIFIED | VERIFIED | STATICALLY REVIEWED | **STATICALLY REVIEWED** | AUD-SEC-001 (`CAP_SYS_ADMIN`) |
| **Database Module** | `src/database/database.module.ts`| VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `DatabaseModule`, pool limits |
| **Submission Store** | `src/database/sharding/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `submission-store.spec.ts`, shard router |
| **Migrations** | `src/database/migrations/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | NOT APPLICABLE | **VERIFIED** | Advisory locking tests |
| **Students Module** | `backend-nestjs/src/students/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | AUD-PRF-002 (Bcrypt starvation) |
| **WebSocket Gateway**| `backend-nestjs/src/gateway/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `gateway.security.spec.ts` |
| **Observability** | `src/observability/metrics/` | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | NOT APPLICABLE | **VERIFIED** | `/api/metrics` controller & Prometheus |
| **S3 Storage** | `backend-nestjs/src/s3/` | VERIFIED | VERIFIED | VERIFIED | NOT APPLICABLE | NOT APPLICABLE | **VERIFIED** | `s3.service.spec.ts` |
| **Terraform VPC** | `terraform/modules/vpc/` | VERIFIED | BLOCKED (Live) | VERIFIED | NOT APPLICABLE | STATICALLY REVIEWED | **STATICALLY REVIEWED** | AUD-REL-001 (Dual NAT Gateway) |
| **Terraform Prod** | `terraform/environments/prod/` | VERIFIED | BLOCKED (Live) | VERIFIED | NOT APPLICABLE | STATICALLY REVIEWED | **STATICALLY REVIEWED** | AUD-FIN-001 ($471/mo budget violation) |
| **Frontend Auth** | `frontend-v2/src/config/api.ts` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | STATICALLY REVIEWED | **VERIFIED** | `api.test.ts`, refresh queue |
| **Frontend Editor** | `frontend-v2/src/components/` | VERIFIED | VERIFIED | NOT APPLICABLE | NOT APPLICABLE | STATICALLY REVIEWED | **STATICALLY REVIEWED** | AUD-PRF-003 (Monaco chunking) |
| **Skill Dev Page** | `frontend-v2/src/app/skill-...` | VERIFIED | VERIFIED | NOT APPLICABLE | NOT APPLICABLE | STATICALLY REVIEWED | **VERIFIED** | AUD-UI-001 (9-col grid squeeze) |

---

## Explicit Audit Limitations & Blockers
1. **Live AWS Mutation Blocked:** In accordance with non-destructive audit rules, live `terraform apply` against AWS was not executed; infrastructure and cost evaluations are derived from current source manifests and verified AWS pricing APIs.
2. **Judge0 Live Execution:** The production cluster operates on `CODE_EXECUTION_PROVIDER=piston`; live Judge0 code execution is dormant in production.
