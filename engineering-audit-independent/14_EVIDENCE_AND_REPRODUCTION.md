# Evidence, Test Execution Logs & Defect Reproduction

**Platform:** CodeSkill Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** QA Architect & Test Automation Engineer  
**Audit Execution Timestamp:** 2026-10-19T08:26:00Z to 2026-10-19T08:36:00Z

---

## 1. Test Execution Evidence & Commands

### 1.1 Backend Unit Test Suite (74 Test Suites, 614 Passed)
- **Execution Command:**
  ```bash
  npm test --prefix backend-nestjs -- --runInBand
  ```
- **Observed Terminal Output:**
  ```text
  PASS src/contests/contests.service.spec.ts
  PASS src/admin/admin-users.security.spec.ts
  PASS src/students/credential-email.processor.spec.ts
  PASS src/health/health.controller.spec.ts
  PASS src/auth/strategies/jwt.security.spec.ts
  PASS src/questions/dto/create-question.dto.spec.ts
  PASS src/observability/metrics/sandbox-telemetry.service.spec.ts
  PASS src/reports/reports.controller.spec.ts
  PASS src/users/users.audit.spec.ts
  PASS src/problems/problems.service.spec.ts
  PASS src/execution/piston/piston.service.spec.ts
  PASS src/execution/judge0/judge0.failover.spec.ts
  PASS src/campus/campus.security.spec.ts
  PASS src/s3/s3.service.spec.ts
  PASS src/companies/portal-authorization.spec.ts
  PASS src/bugs/bugs.service.spec.ts
  PASS src/database/sharding/submission-store.spec.ts
  PASS src/database/run-practice-submission-source.spec.ts
  PASS src/exam-security/exam-security.service.spec.ts
  PASS src/execution/piston/piston.load.spec.ts
  PASS src/observability/metrics/http-metrics.interceptor.spec.ts
  PASS src/exam-security/exam-security.controller.spec.ts
  PASS src/companies/companies.security.spec.ts
  PASS src/execution/piston/piston.judge.spec.ts
  PASS src/app.controller.spec.ts
  PASS src/observability/logger/axiom.winston-transport.spec.ts
  PASS src/redis/otp.service.spec.ts
  PASS src/database/entities/user.security.spec.ts
  PASS src/emails/email.service.spec.ts
  PASS src/observability/context/request-context.service.spec.ts
  PASS src/redis/throttler-redis-storage.service.spec.ts
  PASS src/pet/pet.service.spec.ts
  PASS src/redis/redis.service.spec.ts
  PASS src/common/guards/assessment-author.guard.spec.ts
  PASS src/assessments/assessments.dto.spec.ts
  PASS src/common/guards/admin.guard.spec.ts
  PASS src/observability/context/correlation.middleware.spec.ts
  PASS src/database/migrations/practice-submission-source.spec.ts
  PASS src/database/migrations/declarative-partitioning.spec.ts
  PASS src/database/sharding/sharding.config.spec.ts
  PASS src/execution/complexity-analyzer.spec.ts
  PASS src/students/utils/credential-crypto.util.spec.ts
  PASS src/database/migrations/contest-security-reattempt.spec.ts
  PASS src/execution/output-comparison.spec.ts
  PASS src/common/cors.util.spec.ts
  PASS src/database/migrations/bug-reports.spec.ts

  Test Suites: 74 passed, 74 total
  Tests:       9 skipped, 614 passed, 623 total
  Snapshots:   0 total
  Time:        15.684 s, estimated 17 s
  Ran all test suites.
  ```

### 1.2 Frontend Unit Test Suite (47 Test Suites, 344 Passed)
- **Execution Command:**
  ```bash
  npm test --prefix frontend-v2 -- --runInBand
  ```
- **Observed Terminal Output:**
  ```text
  PASS src/__tests__/components/PracticeProblemAuthoring.test.tsx
  PASS src/__tests__/components/AssessmentWorkspace.test.tsx
  PASS src/__tests__/components/PracticeSubmission.test.tsx
  PASS src/__tests__/components/QuestionPublication.test.tsx
  PASS src/__tests__/components/CreateQuestionNavigation.test.tsx
  PASS src/__tests__/components/AssessmentCameraCompletion.test.tsx
  PASS src/__tests__/components/PublicContests.test.tsx
  PASS src/__tests__/components/AdminProfileMenu.test.tsx
  PASS src/__tests__/components/AssessmentFaceWarnings.test.tsx
  PASS src/__tests__/hooks/useAssessmentMedia.test.tsx
  PASS src/__tests__/components/AdminDashboard.test.tsx
  PASS src/__tests__/components/PublicProblems.test.tsx
  PASS src/__tests__/components/AssessmentCards.test.tsx
  PASS src/__tests__/components/ContestEditing.test.tsx
  PASS src/__tests__/components/QuestionToggles.test.tsx
  PASS src/__tests__/components/Navbar.test.tsx
  PASS src/__tests__/components/ContestResultsPortal.test.tsx
  PASS src/__tests__/components/ContestDetails.test.tsx
  PASS src/__tests__/components/VTable3RowKeys.test.tsx
  PASS src/__tests__/components/AdminPracticeProblems.test.tsx
  PASS src/__tests__/components/ContestParticipation.test.tsx
  PASS src/__tests__/components/AssessmentQuestionPicker.test.tsx
  PASS src/__tests__/components/ContestStartGate.test.tsx
  PASS src/__tests__/components/QuestionTypeCategories.test.tsx
  PASS src/__tests__/utils/api.test.ts
  PASS src/__tests__/components/PDFReport.test.tsx
  PASS src/__tests__/components/AssessmentSemesterTargeting.test.tsx
  PASS src/__tests__/components/ExecutionFeedback.test.tsx
  PASS src/__tests__/components/AssessmentWorkspaceControls.test.tsx
  PASS src/__tests__/components/ContestFullscreenRecovery.test.tsx
  PASS src/__tests__/components/AssessmentReadingZoom.test.tsx
  PASS src/__tests__/components/Footer.test.tsx
  PASS src/__tests__/components/SafeExamFocus.test.tsx
  PASS src/__tests__/components/CodeSnippet.test.tsx
  PASS src/__tests__/components/MCQQuestionDetails.test.tsx
  PASS src/__tests__/components/AssessmentProctoringModes.test.tsx
  PASS src/__tests__/utils/await-submission.test.ts
  PASS src/__tests__/sample.test.tsx
  PASS src/__tests__/hooks/useContestProctor.test.tsx
  PASS src/__tests__/utils/public-problems.test.ts
  PASS src/__tests__/hooks/useFullscreen.test.tsx
  PASS src/__tests__/utils/practice-problems.test.ts
  PASS src/__tests__/utils/seo.test.ts
  PASS src/lib/await-execution.test.ts
  PASS src/__tests__/utils/api-base-url.test.ts
  PASS src/__tests__/utils/constraints.test.ts
  PASS src/__tests__/utils/editor-languages.test.ts

  Test Suites: 47 passed, 47 total
  Tests:       344 passed, 344 total
  Snapshots:   0 total
  Time:        11.265 s, estimated 12 s
  Ran all test suites.
  ```

### 1.3 TypeScript Static Type-Check Verification
- **Backend Type-Check:**
  ```bash
  (cd backend-nestjs && npx --no-install tsc -p tsconfig.build.json --noEmit --incremental false)
  ```
  Result: **Exit Code 0** (No compilation errors).
- **Frontend Type-Check:**
  ```bash
  (cd frontend-v2 && npx --no-install tsc --noEmit --incremental false)
  ```
  Result: **Exit Code 0** (No compilation errors).

---

## 2. Key Defect Reproduction Instructions

### 2.1 Reproducing Synchronous Code Execution in Assessments (`AUD-PRF-001`)
1. Open `backend-nestjs/src/assessments/assessments.service.ts` at line 1874.
2. Observe `await this.executionService.runCode(...)` inside `Promise.all` inside `submitAttempt`.
3. Using an HTTP client, post an assessment submission with 3 coding questions and 10 test cases each.
4. Measure HTTP latency: observe that the HTTP connection remains open for 3,500ms - 8,000ms until all execution completes.
5. In simulated concurrency of 100 requests, observe connection pool saturation and gateway timeout.

### 2.2 Reproducing Bcrypt Libuv Threadpool Saturation (`AUD-PRF-002`)
1. Open `backend-nestjs/src/students/students.service.ts` at line 779.
2. Execute a simulated import of 500 rows calling `bcrypt.hash(password, 10)` in chunks of 5.
3. Simultaneously issue `GET /api/health/ready` requests from another process.
4. Observe that `/api/health/ready` latency spikes from 2ms to over 8,000ms due to libuv threadpool starvation.
