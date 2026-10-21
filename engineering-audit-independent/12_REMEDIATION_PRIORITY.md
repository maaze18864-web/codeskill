# Remediation Priority & Phased Implementation Roadmap

**Platform:** CodeSkill Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** Principal Software Architect & Release Engineering Lead

---

## 1. Remediation Ordering Philosophy

The remediation roadmap follows strict dependency-aware risk sequencing:
1. **Critical Security & FinOps Governance:** Eliminate financial overruns and container escape vulnerabilities.
2. **Data Correctness & Examination Reliability:** Guarantee zero lost submissions and accurate grading during exam peaks.
3. **Performance & Scalability Optimization:** Eliminate event-loop threadpool blocking and database connection exhaustion.
4. **Supply Chain & User Experience Upgrades:** Mitigate library vulnerabilities and improve responsiveness.

---

## 2. Phased Remediation Matrix

### Phase 1: Critical Security & FinOps Governance (Immediate)
| Task ID | Issue ID | Component | Action | Complexity | Regression Risk |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **REM-01** | `AUD-FIN-001` | `terraform/environments/production` | Decommission idle Judge0 ASG; reduce NAT Gateways to 1; switch RDS to Single-AZ with automated snapshots ($234.62/mo baseline) | Medium | Low |
| **REM-02** | `AUD-SEC-001` | `judge0.sh.tftpl` | Remove `CAP_SYS_ADMIN` and enforce `no-new-privileges:true` | Low | Very Low |
| **REM-03** | `AUD-REL-001` | `terraform/modules/vpc` | Set `aws_nat_gateway` count to 1 (saves $36.50/mo) | Low | Low |

### Phase 2: Examination Submission & Concurrency Correctness
| Task ID | Issue ID | Component | Action | Complexity | Regression Risk |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **REM-04** | `AUD-PRF-001` | `assessments.service.ts` | Convert `submitAttempt` coding evaluation from synchronous HTTP loop to asynchronous BullMQ job queue with polling | High | Medium |
| **REM-05** | `AUD-CON-001` | `contests.service.ts` | Guard contest attempt submission against in-flight evaluations to prevent lost problem score points | Medium | Low |
| **REM-06** | `AUD-CON-002` | `app.gateway.ts` | Clean up `socketRateLimits` entries on WebSocket client disconnect | Low | None |

### Phase 3: Performance, CPU & Database Tuning
| Task ID | Issue ID | Component | Action | Complexity | Regression Risk |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **REM-07** | `AUD-PRF-002` | `students.service.ts` | Offload 500-student password hashing to background BullMQ worker queue | Medium | Low |
| **REM-08** | `AUD-DAT-001` | `database.module.ts` | Enforce `DB_POOL_MAX=15` across all environments to prevent RDS connection starvation | Low | Low |
| **REM-09** | `AUD-DAT-002` | `students.service.ts` | Remove redundant un-indexed `count()` calls from `findAll` and cache in Redis | Low | Low |

### Phase 4: Supply Chain & User Experience Upgrades
| Task ID | Issue ID | Component | Action | Complexity | Regression Risk |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **REM-10** | `AUD-SEC-002` | `package.json` | Upgrade SheetJS `xlsx` to secure release (`>= 0.20.0`) | Low | Low |
| **REM-11** | `AUD-PRF-003` | `frontend-v2/src/components` | Lazy-load Monaco Editor via `next/dynamic` (`ssr: false`) | Low | Low |
| **REM-12** | `AUD-UI-001` | `skill-development/page.tsx` | Adopt balanced 3×3 grid for team section to fix desktop layout squeeze | Low | None |
| **REM-13** | `AUD-SEC-004` | `nginx.conf` | Harmonize `client_max_body_size` with Express `limit` at 10MB | Low | None |

---

## 3. Verification Criteria for Production Readiness Sign-Off

Before declaring CodeSkill production-ready for university examinations:
1. **AWS Cost Validation:** Monthly projected bill across all billable resources in `ap-south-1` is demonstrably **$\le$ $240/mo baseline** and **$\le$ $300/mo peak**.
2. **Load & Concurrency Validation:** A simulated burst of 500 simultaneous assessment submissions completes with **0 dropped submissions** and **p95 latency < 1,500ms**.
3. **Threadpool Health:** Administrative student import of 500 rows does not delay concurrent API health checks.
4. **Zero Open High-Severity CVEs:** Clean dependency audit on production packages.
