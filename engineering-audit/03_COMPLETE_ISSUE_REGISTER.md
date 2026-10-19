# 03. COMPLETE ENGINEERING ISSUE REGISTER

**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Standard:** Rigorous, Evidence-Backed Engineering Weakness Register

---

## Issue Summary Matrix

| Issue ID | Severity | Confidence | Category | Affected Component | File Path & Lines |
|---|---|---|---|---|---|
| **ISSUE-SEC-001** | **CRITICAL** | CONFIRMED | Security / Sandbox | Piston Sandbox ASG | `terraform/environments/production/userdata/piston.sh.tftpl:57-61`, `terraform/modules/ec2-asg/main.tf:28` |
| **ISSUE-DAT-001** | **CRITICAL** | CONFIRMED | Data Integrity / State Machine | Assessment Submission | `backend-nestjs/src/assessments/assessments.service.ts:1728-1751` |
| **ISSUE-PRF-001** | **HIGH** | CONFIRMED | Performance / Scalability | Assessment Grading | `backend-nestjs/src/assessments/assessments.service.ts:1827-1873` |
| **ISSUE-INF-001** | **HIGH** | CONFIRMED | Infrastructure / Database | RDS Connection Pooling | `terraform/modules/rds/main.tf:56-61`, `backend-nestjs/src/database/database.module.ts:88` |
| **ISSUE-RES-001** | **HIGH** | CONFIRMED | Reliability / Distributed Systems | Redis Client Connectivity | `backend-nestjs/src/redis/redis.service.ts:20-24` |
| **ISSUE-CON-001** | **HIGH** | CONFIRMED | Concurrency / Race Condition | Contest Reattempts | `backend-nestjs/src/contests/contests.service.ts:351-388` |
| **ISSUE-SEC-002** | **HIGH** | CONFIRMED | Security / Authentication | User Authentication | `backend-nestjs/src/auth/auth.service.ts:107-114, 206-213` |
| **ISSUE-FE-001** | **HIGH** | CONFIRMED | Frontend / Error Protocol | Assessment Submission Retry | `frontend-v2/src/app/assessments/[id]/take/page.tsx:403-423` |
| **ISSUE-PRF-002** | **HIGH** | CONFIRMED | Performance / Event Loop | Student Import Service | `backend-nestjs/src/students/students.service.ts:736-742` |
| **ISSUE-SEC-003** | **MEDIUM** | CONFIRMED | Security / Rate Limiting | Smart Throttler Guard | `backend-nestjs/src/common/guards/smart-throttler.guard.ts:130-135` |
| **ISSUE-SEC-004** | **MEDIUM** | HIGH-CONFIDENCE STATIC | Security / Data In-Transit | ElastiCache Redis Cluster | `terraform/modules/redis/variables.tf:34-45`, `terraform/environments/production/main.tf:379-380` |
| **ISSUE-DAT-002** | **MEDIUM** | CONFIRMED | Performance / Database | Submission Shard Routing | `backend-nestjs/src/database/sharding/submission-store.ts:145-170` |
| **ISSUE-SEC-005** | **MEDIUM** | HIGH-CONFIDENCE STATIC | Supply Chain / Vulnerability | Spreadsheet Import | `backend-nestjs/package.json:88`, `backend-nestjs/src/students/students.service.ts:372` |
| **ISSUE-DAT-003** | **MEDIUM** | CONFIRMED | Database / N+1 & CPU | Student Report Controller | `backend-nestjs/src/reports/reports.controller.ts:81-103, 131-135` |
| **ISSUE-FE-002** | **MEDIUM** | CONDITIONAL RISK | Frontend / Memory Leaks | Proctoring Media Capture | `frontend-v2/src/hooks/useAssessmentMedia.ts`, `frontend-v2/src/components/assessment/AssessmentCamera.tsx` |
| **ISSUE-INF-002** | **MEDIUM** | CONDITIONAL RISK | Infrastructure / High Availability | ALB Target Group Stickiness | `terraform/modules/alb/main.tf:84-88` |
| **ISSUE-INF-003** | **HIGH** | CONFIRMED | Cloud Infrastructure / ASG Scale-out | Backend Startup User-Data | `terraform/environments/production/userdata/backend.sh.tftpl:161-165` |
| **ISSUE-INF-004** | **HIGH** | CONFIRMED | Security / IAM Least Privilege | Application Secrets Policy | `terraform/modules/iam/main.tf:97-117` |
| **ISSUE-INF-005** | **MEDIUM** | CONFIRMED | Security / Edge Defense | Production ALB Protection | `terraform/environments/production/main.tf:246-256`, `terraform/modules/waf/main.tf` |
| **ISSUE-INF-006** | **MEDIUM** | CONFIRMED | Security / Cloud Storage | S3 Bucket Reports & Avatars | `terraform/modules/s3/main.tf:9-33` |
| **ISSUE-INF-007** | **MEDIUM** | CONFIRMED | Infrastructure / Cost & Latency | Next.js SSR Routing | `terraform/environments/production/userdata/frontend.sh.tftpl:80-82` |
| **ISSUE-INF-008** | **MEDIUM** | CONFIRMED | Infrastructure / Service Discovery | Cloud Map Execution Nodes | `terraform/environments/production/userdata/piston.sh.tftpl:94-103` |
| **ISSUE-INF-009** | **LOW** | CONFIRMED | DevOps / Release Engineering | Production Launch Templates | `terraform/environments/production/variables.tf:73-95` |
| **ISSUE-INF-010** | **LOW** | CONFIRMED | Observability / Cloud Monitoring | Infrastructure Alarms | `terraform/modules/monitoring/main.tf:1-25` |
| **ISSUE-OBS-001** | **LOW** | HIGH-CONFIDENCE STATIC | Observability / Resilience | Axiom Log Transport | `backend-nestjs/src/main.ts:54-68`, `backend-nestjs/src/worker.ts:24-38` |
| **ISSUE-QA-001** | **LOW** | CONFIRMED | Quality / Automation Gap | CI Test Pipeline | `.github/workflows/piston-validation.yml`, `backend-nestjs/test/` |

---

## Detailed Issue Specifications

### ISSUE-SEC-001: Piston Sandbox Container Runs Privileged Without Network Isolation in Production Userdata

- **Unique ID:** `ISSUE-SEC-001`
- **Title:** Piston Execution Sandbox Runs Privileged Container with Network Enabled and IMDSv2 Hop Limit = 2
- **Severity:** CRITICAL
- **Confidence Level:** CONFIRMED
- **Category:** Application Security / Container Escape / Cloud Infrastructure
- **Affected Component:** `codeskill-piston-asg` Launch Configuration & EC2 Launch Template
- **Exact File Path & Lines:**
  - `terraform/environments/production/userdata/piston.sh.tftpl:57-61`
  - `terraform/modules/ec2-asg/main.tf:28`
- **Code & Configuration Evidence:**
  ```sh
  # File: terraform/environments/production/userdata/piston.sh.tftpl
  ExecStart=/usr/bin/docker run --rm --name codeskill-piston \
    -p 2001:2000 \
    -v /var/lib/piston:/piston \
    --privileged \
    $PISTON_IMAGE
  ```
  ```tf
  # File: terraform/modules/ec2-asg/main.tf
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  ```
- **Technical Root Cause:**
  1. The production bootstrap template executes the Docker container with `--privileged`.
  2. The mandatory environment flag `-e PISTON_DISABLE_NETWORKING=true` (present in local compose files) was omitted from the production systemd service definition.
  3. The EC2 Launch Template configures `http_put_response_hop_limit = 2` instead of `1`, allowing bridge-networked Docker containers to traverse the network hop to reach the EC2 Instance Metadata Service (IMDSv2).
- **Triggering Conditions:**
  Any authenticated student or attacker submitting code in any supported runtime (e.g. Python, C++, Bash, Node.js) that makes an outbound HTTP PUT/GET request to `169.254.169.254`.
- **Failure Mechanism:**
  Untrusted user code executed inside Piston initiates an HTTP PUT request to `http://169.254.169.254/latest/api/token` with header `X-aws-ec2-metadata-token-ttl-seconds: 300`. Because hop limit is 2, IMDSv2 responds with an authentication token. The code then requests `http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>` and exfiltrates temporary AWS access keys.
- **User or Business Impact:**
  Complete compromise of the AWS production environment, unauthorized access to S3 student proctoring records, database access, and lateral movement across cloud assets.
- **Recommended Engineering Solution:**
  1. In `piston.sh.tftpl`, pass `-e PISTON_DISABLE_NETWORKING=true` and remove `--privileged`, substituting with explicit capability drops: `--cap-drop=ALL --cap-add=SYS_ADMIN`.
  2. In `terraform/modules/ec2-asg/main.tf`, set `http_put_response_hop_limit = 1` for all sandbox launch templates to restrict metadata access strictly to the host OS.
- **Relevant Regression Tests:**
  `scripts/piston/smoke.mjs` verifying that egress socket connection attempts inside Piston fail with `EPERM` or `ENETUNREACH`.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-DAT-001: Permanent Student Deadlock in `'evaluating'` State Machine Upon Network Timeout or Transient Error

- **Unique ID:** `ISSUE-DAT-001`
- **Title:** Assessment Submission CAS State Transition Leaves Attempt Permanently Bricked in `'evaluating'` Without Recovery Lease or Rollback
- **Severity:** CRITICAL
- **Confidence Level:** CONFIRMED
- **Category:** Data Integrity / Concurrency / State Machine
- **Affected Component:** `AssessmentsService.submitAttempt` & `evaluateAttempt`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/assessments/assessments.service.ts:1728-1751`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/assessments/assessments.service.ts
  if (attempt.status === 'evaluating') {
    throw new ConflictException(
      'Assessment submission is currently being evaluated. Please wait.',
    );
  }

  // Atomic CAS transition: in_progress -> evaluating to prevent duplicate concurrent evaluations
  if (attempt.status === 'in_progress') {
    if (typeof this.attemptRepo.update === 'function') {
      const transitionResult = await this.attemptRepo.update(
        { id: attempt.id, status: 'in_progress' },
        { status: 'evaluating' as any },
      );
      if (transitionResult && transitionResult.affected === 0) {
        // ...
        throw new ConflictException(
          'Assessment submission is currently being evaluated. Please wait.',
        );
      }
    }
    attempt.status = 'evaluating' as any;
  }
  // [Code execution runs sequentially without try/catch rollback]
  // attempt.status is only set to 'submitted' at line 2045!
  ```
- **Technical Root Cause:**
  `evaluateAttempt` transitions the attempt status to `'evaluating'` in the database via an atomic CAS update to prevent double-grading. However, the subsequent execution loop (which executes code on Piston, evaluates test cases, and updates score) is not wrapped in a `try...catch...finally` block. If an unhandled error, database timeout, or Nginx client disconnect occurs, or if execution exceeds Nginx's 120s timeout, the attempt remains permanently persisted with `status = 'evaluating'`.
- **Triggering Conditions:**
  1. Nginx `proxy_read_timeout 120s` expires during large coding assessments.
  2. Piston node blips, experiences transient overload, or throws `PistonUnavailableError`.
  3. Server process restarts during grading.
- **Failure Mechanism:**
  When the student or the frontend auto-retry protocol retries the submission, line 1728 checks `if (attempt.status === 'evaluating')` and immediately throws HTTP 409 Conflict. Because there is no expiration timestamp, TTL lease, or cleanup worker, this 409 Conflict persists indefinitely.
- **User or Business Impact:**
  Students cannot submit their examinations. When the test timer reaches zero, the attempt remains unsubmitted with zero marks recorded.
- **Recommended Engineering Solution:**
  1. Add an `evaluatingStartedAt` timestamp column to `assessment_attempts`.
  2. Implement an evaluation lease (e.g. 180 seconds). If `attempt.status === 'evaluating'` and `now - evaluatingStartedAt > 180s`, permit re-evaluation.
  3. Wrap lines 1740–2060 in a `try...catch` block that reverts `status` to `'in_progress'` if an unhandled error occurs.
- **Relevant Regression Tests:**
  `backend-nestjs/src/assessments/assessments.service.spec.ts`: test simulating an error during `runCode` and verifying that subsequent `submitAttempt` calls do not receive a 409 Conflict.
- **Dependencies on Other Fixes:** `ISSUE-FE-001` (frontend retry handling).

---

### ISSUE-PRF-001: Synchronous In-Band Code Execution During Assessment Submission Creates O(N * Q * T) Latency Waterfall

- **Unique ID:** `ISSUE-PRF-001`
- **Title:** Assessment Submission Synchronously Evaluates All Coding Questions Inside HTTP Request Lifecycle
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Performance / Scalability / Architectural Design
- **Affected Component:** `AssessmentsService.evaluateAttempt`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/assessments/assessments.service.ts:1827-1873`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/assessments/assessments.service.ts
  if (isCoding) {
    // ...
    if (this.executionService && totalTestCases > 0) {
      try {
        const tcInputs = testCases.map((tc, idx) => ({ ... }));
        const results = await this.executionService.runCode(
          r.code!,
          r.language || 'python',
          tcInputs,
          { timeLimit: q.timeLimit, memoryLimit: q.memoryLimit },
        );
        testCasesPassed = results.filter((res) => res.passed).length;
  ```
- **Technical Root Cause:**
  Contest submissions correctly decouple execution through BullMQ and `JudgeProcessor`. In contrast, assessment submissions execute every testcase of every coding question synchronously inside the HTTP POST request thread.
- **Triggering Conditions:**
  Concurrent exam submissions when an examination timer expires across hundreds of students simultaneously.
- **Failure Mechanism:**
  For an exam with 2 coding questions and 5 test cases each, 1 submission requires 10 Piston executions (~2.0 seconds). If 100 students submit within a 10-second window, the system requires 1,000 executions. A single Piston node processes ~16 executions/sec, creating a 62.5-second backlog. At 500 students, the backlog reaches 312 seconds, far exceeding Nginx's 120s `proxy_read_timeout`.
- **User or Business Impact:**
  Massive 504 Gateway Timeout storm during exam submissions, triggering cascading retries and locking student attempts.
- **Recommended Engineering Solution:**
  Decouple assessment grading to an asynchronous BullMQ queue (`assessment-submissions`), returning HTTP 202 Accepted with a job ID, and polling or receiving the final scorecard via WebSocket.
- **Relevant Regression Tests:**
  Load test simulating 200 simultaneous submissions asserting p95 response time < 2000ms.
- **Dependencies on Other Fixes:** `ISSUE-DAT-001`.

---

### ISSUE-INF-001: Missing PgBouncer / RDS Proxy Connection Pool Saturation Hazard

- **Unique ID:** `ISSUE-INF-001`
- **Title:** Backend ASG Connection Pool Max (300–900) Exceeds RDS PostgreSQL `max_connections = 200` Due to Missing PgBouncer
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Infrastructure / Database Performance
- **Affected Component:** Terraform RDS & Backend Database Module
- **Exact File Path & Lines:**
  - `terraform/modules/rds/main.tf:56-61`
  - `backend-nestjs/src/database/database.module.ts:88`
  - `terraform/environments/production/main.tf:357-360`
- **Code & Configuration Evidence:**
  ```tf
  # File: terraform/modules/rds/main.tf
  # Parameter group configured for 4 GiB instance (db.t3.medium) with PgBouncer connection pooling
  parameter {
    name         = "max_connections"
    value        = "200"
    apply_method = "pending-reboot"
  }
  ```
  ```ts
  // File: backend-nestjs/src/database/database.module.ts
  const poolConfig = {
    max: parseInt(process.env.DB_POOL_MAX || '50', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
  ```
- **Technical Root Cause:**
  Terraform documentation and comments state that PgBouncer connection pooling is present. However, inspection of all Terraform modules confirms **no PgBouncer instance, container, or AWS RDS Proxy is provisioned**. Each NestJS process configures a pool of 50 connections. With 2 to 6 backend ASG instances running 2 to 3 Node.js processes each, total potential connections range from 200 to 900.
- **Triggering Conditions:**
  Backend Auto Scaling Group scaling beyond 2 instances during peak exam traffic.
- **Failure Mechanism:**
  When connection count exceeds 200, PostgreSQL terminates new connection attempts with `FATAL: sorry, too many clients already`. Existing requests stall waiting for pool checkout, cascading into 500 errors across all API endpoints.
- **User or Business Impact:**
  Global platform outage during Auto Scaling events.
- **Recommended Engineering Solution:**
  1. Deploy an AWS RDS Proxy or PgBouncer sidecar container for the PostgreSQL RDS cluster.
  2. Reduce `DB_POOL_MAX` in `database.module.ts` to 15 per process so that even at 6 instances ($6 \times 2 \times 15 = 180$), total connections remain strictly under RDS `max_connections = 200`.
- **Relevant Regression Tests:**
  `terraform/scripts/test-asg-scaling.sh` verifying PostgreSQL connection metrics during scale-out.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-RES-001: Redis Client Hard-Stops Reconnection After 3 Rapid Failures (`retryStrategy` Returns `null`)

- **Unique ID:** `ISSUE-RES-001`
- **Title:** Redis Service Permanently Terminates Connection on Temporary Network Blip
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Distributed Systems / Resilience / Site Reliability Engineering
- **Affected Component:** `RedisService`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/redis/redis.service.ts:20-24`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/redis/redis.service.ts
  retryStrategy(times: number) {
    if (times > 3) return null;
    const delay = Math.min(times * 100, 1000);
    return delay;
  },
  ```
- **Technical Root Cause:**
  In `ioredis`, returning `null` from `retryStrategy` instructs the client to cease reconnection attempts permanently, moving the client to the `end` state. The retry delay is `times * 100` ms (100ms, 200ms, 300ms = 600ms total).
- **Triggering Conditions:**
  Any ElastiCache failover, network partition, or maintenance event lasting longer than 600 milliseconds.
- **Failure Mechanism:**
  After 3 quick retries, `this.client` permanently dies. All subsequent calls to `redisService.getClient()` operate on a dead connection, throwing unhandled connection errors and crashing rate limiting, OTP verification, and WebSocket event distribution.
- **User or Business Impact:**
  Complete failure of student login and anti-cheat event reporting until every backend NestJS PM2 instance is restarted.
- **Recommended Engineering Solution:**
  Implement exponential backoff with jitter and an upper bound, never returning `null`:
  ```ts
  retryStrategy(times: number) {
    return Math.min(times * 200, 5000) + Math.floor(Math.random() * 200);
  }
  ```
- **Relevant Regression Tests:**
  Unit test simulating Redis server disconnection and verifying that `retryStrategy` continues returning positive reconnection delays beyond 10 attempts.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-CON-001: Non-Transactional Contest Reattempt Grant Check-Then-Act Race Condition (TOCTOU)

- **Unique ID:** `ISSUE-CON-001`
- **Title:** Time-of-Check/Time-of-Use Race Condition in Contest Reattempt Grant Consumption
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Concurrency / Transaction Management
- **Affected Component:** `ContestsService.startAttempt`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/contests/contests.service.ts:351-388`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/contests/contests.service.ts
  const grant = this.reattemptGrantRepo
    ? await this.reattemptGrantRepo.findOne({
        where: { contest_id: contest.id, user_id: userId, status: 'ACTIVE' },
      })
    : null;

  const isValid = grant && (!grant.expiresAt || new Date() < new Date(grant.expiresAt)) &&
    grant.usedAttempts < grant.allowedAttempts;

  if (!isValid) throw new BadRequestException('Your contest attempt has ended');

  // Consume one attempt from the authorized grant
  grant.usedAttempts += 1;
  if (grant.usedAttempts >= grant.allowedAttempts) grant.status = 'USED';
  await this.reattemptGrantRepo?.save(grant);

  // Create new reattempt
  const nextAttemptNumber = (attempt.attemptNumber || 1) + 1;
  const newAttempt = this.attemptRepo.create({ ... });
  attempt = await this.attemptRepo.save(newAttempt);
  ```
- **Technical Root Cause:**
  Checking the grant, incrementing `usedAttempts`, saving the grant, and creating the `ContestAttempt` are executed as separate, non-transactional database operations without row-level locking (`SELECT ... FOR UPDATE`).
- **Triggering Conditions:**
  A student double-clicking the "Reattempt Contest" button or submitting simultaneous start requests.
- **Failure Mechanism:**
  Both concurrent requests read `usedAttempts = 0`. Both increment to 1 and save. Both attempt to insert `ContestAttempt` with `attemptNumber = 2`. Because of `@Index(['contest_id', 'user_id', 'attemptNumber'], { unique: true })`, the second insert crashes with a unique key violation. The grant's counter was already incremented, consuming the student's authorized reattempt without granting access.
- **User or Business Impact:**
  Students lose authorized reattempt grants granted by administrators and are locked out of contests.
- **Recommended Engineering Solution:**
  Wrap the entire reattempt consumption and attempt creation inside a serializable or pessimistic write transaction:
  ```ts
  await this.attemptRepo.manager.transaction(async (manager) => {
    const grant = await manager.findOne(ContestReattemptGrant, {
      where: { contest_id: contest.id, user_id: userId, status: 'ACTIVE' },
      lock: { mode: 'pessimistic_write' },
    });
    // atomic increment & attempt creation
  });
  ```
- **Relevant Regression Tests:**
  Concurrent test executing 2 parallel `startAttempt` calls with 1 allowed reattempt, asserting exactly 1 succeeds and 1 receives an HTTP 400 rejection.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-SEC-002: Unrestricted SQL LIKE Wildcard Matching in `AuthService.login`

- **Unique ID:** `ISSUE-SEC-002`
- **Title:** Unescaped SQL LIKE Wildcards in Login Query Enable Account Ambiguity and Credential Stuffing
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Application Security / Authentication
- **Affected Component:** `AuthService.login` & `adminLogin`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/auth/auth.service.ts:107-114, 206-213`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/auth/auth.service.ts
  const user = await this.userRepository.findOne({
    where: [
      { email: ILike(raw) },
      { uid: ILike(raw) },
      { username: ILike(raw) },
      { name: ILike(raw) },
      { email: ILike(`${raw}@%`) },
    ],
  ```
- **Technical Root Cause:**
  `raw` is passed directly into TypeORM's `ILike(...)` without sanitizing `%` or `_` characters. Additionally, matching by non-unique fields (`name`) and arbitrary domain suffixes (`${raw}@%`) allows ambiguous multi-user matching.
- **Triggering Conditions:**
  An attacker submitting `email: "%"` or `email: "admin%"` with a credential dictionary.
- **Failure Mechanism:**
  `findOne` without an `ORDER BY` returns the first matching database row. If an attacker submits `%`, PostgreSQL matches the first record in the `users` table (typically the initial administrator created during seeding).
- **User or Business Impact:**
  Account takeover risk through wildcard credential guessing.
- **Recommended Engineering Solution:**
  Remove `name: ILike(raw)` and `email: ILike(`${raw}@%`)`. Replace with strict, exact-match equality on unique columns:
  ```ts
  const normalized = raw.toLowerCase().trim();
  const user = await this.userRepository.findOne({
    where: [{ email: normalized }, { uid: normalized.toUpperCase() }, { username: normalized }],
  });
  ```
- **Relevant Regression Tests:**
  Unit test asserting that login with `email: "%"` returns HTTP 401.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-FE-001: Disconnected Frontend/Backend Retry Protocol on Assessment Submission

- **Unique ID:** `ISSUE-FE-001`
- **Title:** Frontend Submissions Retry Loop Intercepted by Backend 409 Conflict Response
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Frontend Architecture / Error Protocol
- **Affected Component:** `frontend-v2/src/app/assessments/[id]/take/page.tsx`
- **Exact File Path & Lines:**
  - `frontend-v2/src/app/assessments/[id]/take/page.tsx:403-423`
- **Code Evidence:**
  ```ts
  // File: frontend-v2/src/app/assessments/[id]/take/page.tsx
  for (let retry = 0; retry < 3; retry++) {
    try {
      await studentAssessmentsAPI.submitAttempt(id, payload);
      lastError = null;
      break;
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const transient = !status || status === 429 || status >= 500;
      if (!transient || retry === 2) break;
      await new Promise((resolve) => window.setTimeout(resolve, 750 * (retry + 1)));
    }
  }
  ```
- **Technical Root Cause:**
  The frontend retry loop only considers `!status`, `429`, or `>= 500` as transient. When a 504 timeout occurs on attempt 1, backend has already flipped status to `'evaluating'`. Attempt 2 returns HTTP 409 Conflict. Because 409 is not considered transient, the frontend immediately aborts its retry loop and shows a permanent error banner.
- **Triggering Conditions:**
  Any network timeout during grading.
- **Failure Mechanism:**
  The frontend client aborts retries on the very first retry attempt because the backend responds with 409 instead of queuing or honoring idempotency.
- **User or Business Impact:**
  Students receive confusing error messages and believe their exam was not recorded.
- **Recommended Engineering Solution:**
  Align frontend and backend protocols: Backend must return 200 with the existing evaluation result or 202 if still processing, rather than throwing a non-retriable 409 Conflict.
- **Dependencies on Other Fixes:** `ISSUE-DAT-001`.

---

### ISSUE-PRF-002: Synchronous Bcrypt Hashing in Bulk Student Import Starves libuv Thread Pool

- **Unique ID:** `ISSUE-PRF-002`
- **Title:** In-Band Sequential Bcrypt Hashing Blocks Worker Process for Minutes During CSV Import
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Performance / Event Loop / CPU Starvation
- **Affected Component:** `StudentsService.confirmImport`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/students/students.service.ts:736-742`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/students/students.service.ts
  const salt = await bcrypt.genSalt(10);
  for (const row of rowsToInsert) {
    const rawPassword = row.password || this.generateSecurePassword(12);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);
  ```
- **Technical Root Cause:**
  Bcrypt hashing at cost 10 takes ~100ms per password. Hashing 2,000 passwords in a sequential loop consumes 200 seconds of libuv worker thread time.
- **Triggering Conditions:**
  Administrator importing a standard college cohort CSV/Excel file (1,000–5,000 students).
- **Failure Mechanism:**
  The HTTP request exceeds Nginx's 120s timeout. Concurrently, libuv threads are starved, delaying file I/O, DNS resolution, and crypto operations across all other requests on that NestJS instance.
- **User or Business Impact:**
  Admin import fails with 504 Gateway Timeout. System experiences severe latency spikes for all concurrent users.
- **Recommended Engineering Solution:**
  Offload password hashing and student creation to a background BullMQ queue (`student-import-queue`), returning an import job ID immediately.
- **Dependencies on Other Fixes:** None.

---

### ISSUE-SEC-003: `SmartThrottlerGuard` Reads Client-Supplied `X-Forwarded-For` Without Express `trust proxy` Verification

- **Unique ID:** `ISSUE-SEC-003`
- **Title:** IP Rate-Limiting Bypass via Attacker-Controlled `X-Forwarded-For` Header
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Application Security / Rate Limiting
- **Affected Component:** `SmartThrottlerGuard.resolveClientIp`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/common/guards/smart-throttler.guard.ts:130-135`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/common/guards/smart-throttler.guard.ts
  private resolveClientIp(req: Record<string, any>): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
  ```
- **Technical Root Cause:**
  When a request passes through a reverse proxy, the client's original header is placed first: `X-Forwarded-For: <spoofed_ip>, <real_ip>`. Reading `forwarded.split(',')[0]` blindly trusts the leftmost, attacker-supplied value. Furthermore, Express `trust proxy` is not configured in `main.ts`.
- **Triggering Conditions:**
  An attacker sending requests with randomized `X-Forwarded-For: 10.x.x.x` headers.
- **Failure Mechanism:**
  Each request is assigned a unique IP bucket (`ip:<spoofed_ip>`), completely bypassing rate limits on unauthenticated endpoints.
- **User or Business Impact:**
  Brute-force attacks against student login and automated API scraping cannot be throttled.
- **Recommended Engineering Solution:**
  Enable `app.set('trust proxy', 1)` in `main.ts` and rely strictly on `req.ip`.

---

### ISSUE-SEC-004: Unencrypted ElastiCache Redis Cluster in Production

- **Unique ID:** `ISSUE-SEC-004`
- **Title:** ElastiCache Redis Cluster Configured Without In-Transit TLS or At-Rest Encryption
- **Severity:** MEDIUM
- **Confidence Level:** HIGH-CONFIDENCE STATIC
- **Category:** Cloud Security / Data Governance
- **Affected Component:** Terraform Redis Module
- **Exact File Path & Lines:**
  - `terraform/modules/redis/variables.tf:34-45`
  - `terraform/environments/production/main.tf:379-380`
- **Code Evidence:**
  ```tf
  # File: terraform/environments/production/main.tf
  redis_cluster_mode = "true"
  redis_tls          = "false"
  ```
  ```tf
  # File: terraform/modules/redis/variables.tf
  variable "transit_encryption_enabled" { default = false }
  variable "at_rest_encryption_enabled" { default = false }
  ```
- **Technical Root Cause:**
  Terraform production variables default `transit_encryption_enabled` and `at_rest_encryption_enabled` to `false`.
- **Triggering Conditions:**
  Production deployment.
- **Failure Mechanism:**
  Redis data (OTP pepper digests, user session payloads, admission leases) is stored in unencrypted memory/disk and transmitted across VPC subnets in plaintext.
- **User or Business Impact:**
  Non-compliance with data privacy regulations (GDPR, FERPA) and vulnerability to packet sniffing in case of VPC misconfiguration.
- **Recommended Engineering Solution:**
  Set `transit_encryption_enabled = true`, `at_rest_encryption_enabled = true`, and configure `auth_token` in `terraform/environments/production/main.tf`.

---

### ISSUE-DAT-002: Cross-Shard Fan-out and O(Shards * (Skip + Take)) Memory/CPU Explosion in `SubmissionStore.find`

- **Unique ID:** `ISSUE-DAT-002`
- **Title:** Cross-Shard Submission Pagination Fetches `skip + take` Rows from Every Shard into Memory
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Database Performance / Scalability
- **Affected Component:** `SubmissionStore.find`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/database/sharding/submission-store.ts:145-170`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/database/sharding/submission-store.ts
  const results = await Promise.all(
    repos.map((repo) =>
      repo.find({
        ...rest,
        take: skip + take,
        order: { createdAt: createdAtDirection, id: idDirection },
      }),
    ),
  );
  const rows = results.flat().sort(...).slice(skip, skip + take);
  ```
- **Technical Root Cause:**
  When querying submissions across shards without a `userId` filter (e.g. admin submission table), the application queries all shards for `skip + take` rows, concatenates them, and sorts in Node.js memory.
- **Triggering Conditions:**
  Admin navigating to page 50 of submissions (`skip = 1000, take = 20`) with 4 shards.
- **Failure Mechanism:**
  Each shard returns 1,020 rows (4,080 rows total over PostgreSQL wire), transferring megabytes of JSON data into Node memory for in-process sorting.
- **User or Business Impact:**
  Node.js memory spikes and potential Out-Of-Memory (OOM) crashes under deep pagination.
- **Recommended Engineering Solution:**
  Replace offset pagination with keyset (cursor-based) pagination (`WHERE (createdAt, id) < (:lastCreatedAt, :lastId)`).

---

### ISSUE-SEC-005: Known Vulnerabilities in `xlsx 0.18.5` Processing Untrusted Spreadsheets

- **Unique ID:** `ISSUE-SEC-005`
- **Title:** Unpatched Prototype Pollution and ReDoS in `xlsx 0.18.5`
- **Severity:** MEDIUM
- **Confidence Level:** HIGH-CONFIDENCE STATIC
- **Category:** Supply Chain Security
- **Affected Component:** `backend-nestjs/package.json`
- **Exact File Path & Lines:**
  - `backend-nestjs/package.json:88`
  - `backend-nestjs/src/students/students.service.ts:372`
- **Technical Root Cause:**
  `xlsx: ^0.18.5` contains known vulnerabilities: CVE-2023-30533 (Prototype Pollution) and CVE-2024-22363 (ReDoS).
- **User or Business Impact:**
  Denial of Service or unexpected object mutation upon uploading maliciously crafted Excel files.
- **Recommended Engineering Solution:**
  Migrate to modern, actively maintained libraries such as `exceljs` or parse CSV files natively with `csv-parse`.

---

### ISSUE-DAT-003: N+1 Query Cascade and CPU-Blocking PDF Generation on Node.js Main Thread

- **Unique ID:** `ISSUE-DAT-003`
- **Title:** Synchronous PDF Rendering and Iterative Question Lookups in Report Controller
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Database Performance / Resource Contention
- **Affected Component:** `ReportsController.getStudentResultReport`
- **Exact File Path & Lines:**
  - `backend-nestjs/src/reports/reports.controller.ts:81-103, 131-135`
- **Code Evidence:**
  ```ts
  // File: backend-nestjs/src/reports/reports.controller.ts
  const questions = await Promise.all(
    responses.map(async (resp: any) => {
      const q = resp.questionId
        ? await this.questionRepo.findOne({
            where: [{ id: resp.questionId }, { mongoId: resp.questionId }],
          })
        : null;
  // ...
  const stream = await renderToStream(React.createElement(StudentResultReport, ...));
  ```
- **Technical Root Cause:**
  1. Iterating over responses issuing single `findOne` queries causes N+1 database roundtrips.
  2. `@react-pdf/renderer` layout calculation executes CPU-heavy rendering synchronously on the event loop.
- **User or Business Impact:**
  Downloading examination result PDFs blocks concurrent API requests for 500ms–2000ms.
- **Recommended Engineering Solution:**
  1. Batch fetch questions with `this.questionRepo.find({ where: { id: In(questionIds) } })`.
  2. Cache generated report PDFs in S3, or offload PDF generation to a worker process.

---

### ISSUE-FE-002: Frontend Unbounded Canvas and Webcam Video Memory Growth During Proctored Assessments

- **Unique ID:** `ISSUE-FE-002`
- **Title:** Incomplete MediaStreamTrack Disposal During Long-Running Proctored Exams
- **Severity:** MEDIUM
- **Confidence Level:** CONDITIONAL RISK
- **Category:** Frontend Performance / Memory Management
- **Affected Component:** `frontend-v2/src/hooks/useAssessmentMedia.ts`
- **Technical Root Cause:**
  Periodic video canvas snapshotting for face verification creates HTML5 Canvas elements that are not explicitly garbage-collected or re-used.
- **User or Business Impact:**
  Browser tab crashes due to JavaScript heap exhaustion (OOM) during 3-hour proctored examinations on low-RAM student laptops.
- **Recommended Engineering Solution:**
  Reuse a single hidden canvas element for snapshots and call `track.stop()` explicitly in `useEffect` cleanup.

---

### ISSUE-INF-002: ALB Backend Stickiness Pins Students to Terminating Instances During Auto Scaling Refreshes

- **Unique ID:** `ISSUE-INF-002`
- **Title:** ALB `lb_cookie` Stickiness Causes WebSocket and API Drops During Instance Rotation
- **Severity:** MEDIUM
- **Confidence Level:** CONDITIONAL RISK
- **Category:** Infrastructure Reliability / Auto Scaling
- **Affected Component:** `terraform/modules/alb/main.tf:84-88`
- **Code Evidence:**
  ```tf
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 3600
    enabled         = true
  }
  ```
- **Technical Root Cause:**
  Because `lb_cookie` stickiness is enabled on the backend target group with a 3600s duration, requests from a student browser are pinned to an individual EC2 instance. When Auto Scaling performs an instance refresh or scales down, deregistration delay is only 30s.
- **User or Business Impact:**
  Students experience abrupt WebSocket disconnects and exam disruption during deployment rollouts.
- **Recommended Engineering Solution:**
  Remove ALB backend stickiness. Rely on the Redis Socket.IO adapter for stateless WebSocket message distribution across all backend nodes.

---

### ISSUE-OBS-001: Silent Log Drop and Failure to Alert When Axiom Fails Open

- **Unique ID:** `ISSUE-OBS-001`
- **Title:** Axiom Transport Catch Block Silently Swallows Initialization Failures Without Fallback Queue
- **Severity:** LOW
- **Confidence Level:** HIGH-CONFIDENCE STATIC
- **Category:** Observability / Incident Response
- **Affected Component:** `backend-nestjs/src/main.ts:54-68`
- **Code Evidence:**
  ```ts
  try {
    const { AxiomWinstonTransport } = require('./observability/logger/axiom.winston-transport');
    winstonTransports.push(new AxiomWinstonTransport({ ... }));
  } catch {
    // Fail-open if transport cannot be loaded
  }
  ```
- **Technical Root Cause:**
  If the Axiom logging transport fails to load or experiences network rejection, the catch block silently ignores the error.
- **User or Business Impact:**
  Loss of audit trails and error telemetry during critical incidents without alerting operators.
- **Recommended Engineering Solution:**
  Log a fatal warning to console and CloudWatch if cloud telemetry fails to initialize.

---

### ISSUE-QA-001: Absence of Automated Concurrency and Distributed Race Condition Tests in CI

- **Unique ID:** `ISSUE-QA-001`
- **Title:** Automated CI Pipeline Runs Only Isolated Unit Tests, Missing Concurrency and Integration Regressions
- **Severity:** LOW
- **Confidence Level:** CONFIRMED
- **Category:** QA Automation / CI/CD Pipeline
- **Affected Component:** `.github/workflows/`
- **Technical Root Cause:**
  CI runs `npm test` with mock repositories. Integration tests (`test:shards:integration`, `test:judges:integration`) and k6 concurrency scripts are never executed in automated CI gates.
- **User or Business Impact:**
  Concurrency races and database schema regressions reach production unnoticed.
- **Recommended Engineering Solution:**
  Add a disposable Docker Compose step in GitHub Actions running shard integration and concurrent submission tests.

---

### ISSUE-INF-003: Concurrent Startup Schema Migration Execution During Backend ASG Scale-Out

- **Unique ID:** `ISSUE-INF-003`
- **Title:** Backend ASG User-Data Executes Un-Locked Database Migrations on Every Node Startup
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Infrastructure / Reliability / Database Migrations
- **Affected Component:** `terraform/environments/production/userdata/backend.sh.tftpl:161-165`
- **Code Evidence:**
  ```bash
  # File: terraform/environments/production/userdata/backend.sh.tftpl:161-165
  # Run the migration in the same image/configuration before accepting requests.
  docker run --rm --env-file /opt/codeskill/backend.env \
    -v /opt/codeskill/rds-global-bundle.pem:/app/certs/rds-global-bundle.pem:ro \
    "$IMAGE" node dist/database/run-practice-submission-source.js
  ```
- **Technical Root Cause:**
  Every booting backend EC2 instance runs `node dist/database/run-practice-submission-source.js` directly in user-data before starting the API process. When the ASG scales up under load, multiple instances boot concurrently and run un-locked `ALTER TABLE` DDL queries against the shared RDS PostgreSQL instance simultaneously, causing lock deadlocks.
- **User or Business Impact:**
  Bootstrap failures on scaling nodes; new instances fail health checks and get terminated in an infinite failure loop during traffic spikes.
- **Recommended Engineering Solution:**
  Remove migration execution from instance user-data. Execute migrations exclusively via CI/CD release pipelines or dedicated one-off ECS migration tasks before deploying application updates.

---

### ISSUE-INF-004: Overly Permissive Wildcard IAM Policy on Backend Application Role

- **Unique ID:** `ISSUE-INF-004`
- **Title:** Backend Application IAM Role Grants Unrestricted `"Resource": "*"` for Secrets Manager and SSM Parameters
- **Severity:** HIGH
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Security / IAM Least Privilege
- **Affected Component:** `terraform/modules/iam/main.tf:97-117`
- **Configuration Evidence:**
  ```terraform
  # File: terraform/modules/iam/main.tf:97-117
  resource "aws_iam_policy" "app_secrets" {
    name = "${var.name_prefix}-app-secrets"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "*"
      }]
    })
  }
  ```
- **Technical Root Cause:**
  IAM policy fails to scope resources to `${var.name_prefix}` secrets or specific database secret ARNs.
- **User or Business Impact:**
  Any compromised backend instance can exfiltrate all secrets and parameters across the entire AWS account.
- **Recommended Engineering Solution:**
  Scope the IAM statement to exact secret ARNs: `Resource = ["${var.db_secret_arn}", "arn:aws:ssm:.../codeskill/*"]`.

---

### ISSUE-INF-005: Omission of AWS WAF Web ACL Association on Production ALB

- **Unique ID:** `ISSUE-INF-005`
- **Title:** Production Application Load Balancer Operates Without AWS WAF Protection
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Security / Edge Defense
- **Affected Component:** `terraform/environments/production/main.tf:246-256`, `terraform/modules/waf/main.tf`
- **Technical Root Cause:**
  Although `modules/waf` is defined, `production/main.tf` never instantiates it or attaches `aws_wafv2_web_acl_association` to `module.alb.alb_arn`.
- **User or Business Impact:**
  Public endpoints lack Layer 7 protection against SQLi, XSS bots, and volumetric HTTP request floods.
- **Recommended Engineering Solution:**
  Instantiate `module "waf"` in `terraform/environments/production/main.tf` passing `alb_arn = module.alb.alb_arn`.

---

### ISSUE-INF-006: S3 Bucket Encryption Omission and Co-Mingled Public/Private Access

- **Unique ID:** `ISSUE-INF-006`
- **Title:** S3 Storage Bucket Omits Default Server-Side Encryption and Co-Mingles Public Avatars with Private Assessment Reports
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Storage Security / Data Protection
- **Affected Component:** `terraform/modules/s3/main.tf:9-33`
- **Configuration Evidence:**
  ```terraform
  # File: terraform/modules/s3/main.tf:9-33
  resource "aws_s3_bucket_public_access_block" "main" {
    bucket = aws_s3_bucket.main.id
    block_public_acls       = true
    block_public_policy     = false
    ignore_public_acls      = true
    restrict_public_buckets = false
  }
  ```
- **Technical Root Cause:**
  Public bucket access restrictions are disabled to allow `/avatars/*` public read policy in the same bucket used for private student PDF reports and candidate test files. Default AES256/KMS encryption is omitted.
- **User or Business Impact:**
  Stored student reports are unencrypted at rest; risk of accidental disclosure of student examination files via key prefix misconfiguration.
- **Recommended Engineering Solution:**
  Split into two separate buckets (`codeskill-public-assets` with public policy, and `codeskill-private-reports` with strict block public access and AWS KMS SSE encryption).

---

### ISSUE-INF-007: Next.js SSR Internal Backend Traffic Routed Externally via NAT Gateway

- **Unique ID:** `ISSUE-INF-007`
- **Title:** Next.js Server-Side Rendering Egresses Through NAT Gateway to Reach Local Backend API
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Cloud Architecture / FinOps / Network Latency
- **Affected Component:** `terraform/environments/production/userdata/frontend.sh.tftpl:80-82`
- **Code Evidence:**
  ```bash
  # File: terraform/environments/production/userdata/frontend.sh.tftpl:80-82
  -e NEXT_PUBLIC_API_URL=https://${domain_name}/api \
  -e NEXT_PUBLIC_SOCKET_URL=https://${domain_name} \
  -e INTERNAL_BACKEND_URL=https://${domain_name}/api \
  ```
- **Technical Root Cause:**
  `INTERNAL_BACKEND_URL` is set to the external public domain `https://${domain_name}/api` rather than an internal VPC DNS record or private ALB listener.
- **User or Business Impact:**
  Internal server-to-server calls leave the VPC via NAT Gateway, incurring AWS data processing charges ($0.045/GB) and adding $\sim 45\text{ ms}$ latency per SSR render.
- **Recommended Engineering Solution:**
  Route `INTERNAL_BACKEND_URL` to internal service discovery (`http://backend.codeskill.internal:5001/api`) or private ALB listener.

---

### ISSUE-INF-008: Cloud Map Execution Node Unwired Deregistration Hook on Termination

- **Unique ID:** `ISSUE-INF-008`
- **Title:** Piston and Judge0 Execution Nodes Leave Orphaned DNS Records in Cloud Map on ASG Scale-In
- **Severity:** MEDIUM
- **Confidence Level:** CONFIRMED
- **Category:** Reliability / Service Discovery / Auto Scaling
- **Affected Component:** `terraform/environments/production/userdata/piston.sh.tftpl:94-103`
- **Code Evidence:**
  ```bash
  # File: terraform/environments/production/userdata/piston.sh.tftpl:94-103
  cat << 'EOF' > /usr/local/bin/deregister-cloudmap.sh
  aws servicediscovery deregister-instance --service-id "${piston_service_id}" ...
  EOF
  chmod +x /usr/local/bin/deregister-cloudmap.sh
  ```
- **Technical Root Cause:**
  The deregistration script is written to `/usr/local/bin/deregister-cloudmap.sh` but never registered with systemd as a shutdown unit. Cloud Map uses custom health checks without Route 53 probing.
- **User or Business Impact:**
  Terminated execution nodes remain in `piston.codeskill.internal` DNS for up to TTL expiry, causing backend code compilation requests to fail intermittently with connection refused.
- **Recommended Engineering Solution:**
  Add a systemd unit `cloudmap-deregister.service` with `ExecStart=/usr/local/bin/deregister-cloudmap.sh` hooked into `shutdown.target`.

---

### ISSUE-INF-009: Mutable Docker Image Tags (`:latest`) in Production Launch Templates

- **Unique ID:** `ISSUE-INF-009`
- **Title:** Production Launch Templates Pull Mutable `:latest` Container Tags, Breaking Immutability
- **Severity:** LOW
- **Confidence Level:** CONFIRMED
- **Category:** Release Engineering / Configuration Management
- **Affected Component:** `terraform/environments/production/variables.tf:73-95`
- **Configuration Evidence:**
  ```terraform
  # File: terraform/environments/production/variables.tf:73-95
  variable "backend_image_tag" {
    type    = string
    default = "latest"
  }
  ```
- **Technical Root Cause:**
  Launch templates reference `${module.ecr.backend_repository_url}:${var.backend_image_tag}` where the variable defaults to mutable `"latest"`.
- **User or Business Impact:**
  ASG scale-out events can pull different code versions over time, creating heterogeneous fleet behavior and rendering automated rollbacks non-deterministic.
- **Recommended Engineering Solution:**
  Enforce Git commit SHA or semantic release tags (e.g., `v2.4.1`) as required, non-default variables.

---

### ISSUE-INF-010: Absence of Amazon CloudWatch Alarms and Dashboards for AWS Infrastructure

- **Unique ID:** `ISSUE-INF-010`
- **Title:** CloudWatch Infrastructure Metrics, Alarms, and Operational Dashboards Omitted
- **Severity:** LOW
- **Confidence Level:** CONFIRMED
- **Category:** Observability / Site Reliability Engineering
- **Affected Component:** `terraform/modules/monitoring/main.tf:1-25`
- **Configuration Evidence:**
  ```terraform
  # File: terraform/modules/monitoring/main.tf:1-4
  # Open-Source Monitoring Module (Prometheus + Grafana OSS + Loki + Promtail + Kuma)
  # Zero Amazon CloudWatch Agent, Zero CloudWatch Alarms, Zero CloudWatch Dashboards
  ```
- **Technical Root Cause:**
  Monitoring module explicitly provisions zero CloudWatch alarms for AWS native services (RDS CPU, RDS FreeStorageSpace, ALB 5XX rate, Target Response Time, Redis EngineCPU).
- **User or Business Impact:**
  Cloud outages (such as RDS connection exhaustion or storage saturation) go undetected until external users report failures.
- **Recommended Engineering Solution:**
  Provision standard CloudWatch alarms for RDS `DatabaseConnections >= 180`, `FreeStorageSpace <= 5GB`, and ALB `HTTPCode_Target_5XX_Count >= 10`.

