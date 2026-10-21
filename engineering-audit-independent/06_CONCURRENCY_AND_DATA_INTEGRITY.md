# Concurrency, Race Conditions & Data Integrity Audit

**Platform:** CodeSkill Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** Distributed Systems & Concurrency Engineer

---

## 1. Concurrency Risk Matrix & Shared-State Analysis

| Shared State Operation | Concurrency Pattern | Hazard Identified | Existing Protection | Risk Status |
| :--- | :--- | :--- | :--- | :--- |
| **Assessment Attempt Start** | Check-Then-Act on existing attempts | Duplicate concurrent attempts created | Unique index `(assessmentId, studentId)` | **SAFE** |
| **Assessment Progress Autosave** | Concurrent rapid autosaves (`saveProgress`) | Lost update / state overwrite | Optimistic CAS / timestamp ordering | **SAFE** |
| **Assessment Final Submit** | Simultaneous clicks on "Submit Exam" | Duplicate grading & double score calculation | Atomic CAS `in_progress` -> `evaluating` | **SAFE (CAS Active)** |
| **Contest Final Submit** | Read submissions -> calculate -> update attempt | Inconsistent score read during async grading | Unprotected SELECT count(*) | **HIGH RISK (`AUD-CON-001`)** |
| **Contest Reattempt Grant** | Reattempt consumption by multiple tabs | Double spending of reattempt allowance | Atomic decrement query | **SAFE** |
| **User Registration / Import** | Concurrent imports with same student UID | Duplicate UID insert | PostgreSQL UNIQUE constraint on `users(uid)` | **SAFE** |
| **Code Execution Queue** | Worker crashes while running student code | Orphaned jobs / stuck in-progress status | BullMQ stalled job lock & admission heartbeat | **SAFE** |
| **Database Migrations** | Multiple ASG backend nodes boot simultaneously | Race condition during DDL schema migration | PostgreSQL `pg_advisory_xact_lock` | **SAFE** |

---

## 2. In-Depth Analysis of Critical Concurrency Paths

### 2.1 Assessment Submission CAS Protection (Confirmed Safe)
In `backend-nestjs/src/assessments/assessments.service.ts` (lines 1753-1770):
```typescript
if (attempt.status === 'in_progress') {
  const transitionResult = await this.attemptRepo.update(
    { id: attempt.id, status: 'in_progress' },
    { status: 'evaluating' as any },
  );
  if (transitionResult && transitionResult.affected === 0) {
    const rechecked = await this.attemptRepo.findOne({ where: { id: attempt.id } });
    if (rechecked?.status === 'submitted' || rechecked?.status === 'auto_submitted') {
      return this.getStudentResult(assessment.id, studentUser);
    }
    throw new ConflictException('Assessment submission is currently being evaluated.');
  }
}
```
- **Evaluation:** This is an atomic Compare-And-Swap (CAS) update executed directly at the PostgreSQL level. If two requests from separate tabs hit the server simultaneously, exactly one succeeds (`affected === 1`), while the second receives `affected === 0` and is cleanly routed to `ConflictException` or returns the completed result.

### 2.2 Contest Score Calculation Race Condition (`AUD-CON-001`)
In `backend-nestjs/src/contests/contests.service.ts` (lines 477-510):
```typescript
// 1. Un-locked SELECT across submissions
const solved = await this.attemptRepo.query(
  `SELECT count(DISTINCT "problemId") as count 
   FROM submissions 
   WHERE "userId"::text = $1 AND "problemId" = ANY($2::uuid[]) AND lower(status) = 'accepted'
     AND "createdAt" >= $3`,
  [userId, problemIds, attempt.startedAt],
);
problemsSolved = Number(solved[0]?.count || 0);
const score = problemsSolved * 100;

// 2. Update attempt status to 'Submitted'
await this.attemptRepo.createQueryBuilder().update().set({
  status: 'Submitted',
  problemsSolved,
  score,
}).where('id = :id AND status = :status', { id: attempt.id, status: 'InProgress' }).execute();
```
- **Hazard:**
  If a student submits their code for Problem C at 10:59:55 AM, and clicks "Finish Contest" at 10:59:57 AM while the BullMQ worker is still running test cases for Problem C:
  1. The `SELECT` query runs while Problem C is still in status `running`.
  2. The count returns only Problem A and B (`problemsSolved = 2`, `score = 200`).
  3. The attempt is updated to `Submitted`.
  4. 2 seconds later, the BullMQ worker completes Problem C with `accepted`.
  5. The contest attempt status is already `Submitted`; the student permanently loses 100 points.
- **Recommended Remedy:**
  Before finalizing contest submission, query the BullMQ queue / submission store to verify whether any submissions for that contest and user are currently `queued` or `running`. If pending, await completion with a short timeout or return a polite "Submissions still evaluating" response.

### 2.3 Migration Advisory Locking (Confirmed Safe)
In `backend-nestjs/src/database/run-practice-submission-source.ts` (line 52):
```typescript
await queryRunner.query('SELECT pg_advisory_xact_lock(1902230159)');
```
- **Evaluation:** When an Auto Scaling Group boots 4 backend instances simultaneously, each attempts to run migrations. PostgreSQL evaluates `pg_advisory_xact_lock(1902230159)`. The first instance acquires the lock and executes DDL within a transaction. The remaining 3 instances block at the lock until the transaction commits, then proceed sequentially and discover all tables already created (idempotent DDL).

---

## 3. Data Integrity Invariants & Verification

| Business Invariant | Enforcement Mechanism | Failure Recovery Path |
| :--- | :--- | :--- |
| **No Negative Assessment Scores** | Clamped at 0 in `submitAttempt` | Database CHECK constraint recommended |
| **No Duplicate MCQ Options** | ValidationPipe + DTO schema | Handled in `create-question.dto` |
| **No Orphaned Submission Records** | `SubmissionStore` routes to user shard | Primary fallback repository |
| **Immutable Submitted Attempts** | Attempt status locked once `submitted` | Further edits rejected with 400 Bad Request |
| **Single Active Exam Session** | Redis session key check | Forced termination of older session |
