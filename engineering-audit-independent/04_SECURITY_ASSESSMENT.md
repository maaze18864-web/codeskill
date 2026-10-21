# Comprehensive Security Assessment & Threat Model

**Platform:** CodeSkill Examination & Online Judge System  
**Repository Baseline:** `f0b6f591b012407137979a39befc9f8b5544ede7`  
**Discipline:** Application Security Architect & Threat Modeling Engineer  
**Security Standards Mapped:** OWASP ASVS v4.0.3 (Level 2), OWASP Top 10 (2021), CWE Top 25

---

## 1. Threat Model & Asset Inventory

### 1.1 Core Business Assets
1. **Student Examination Answers & Integrity:** Raw code and MCQ responses submitted during high-stakes exams.
2. **Hidden Test Cases & Problem Keys:** Hidden unit tests, reference solutions, and scoring criteria.
3. **Identity & Authentication Credentials:** Student password hashes, active JWT refresh token hashes, OTP codes.
4. **Execution Sandbox Infrastructure:** Dedicated Linux kernel and compute nodes executing untrusted arbitrary code.
5. **Proctoring Telemetry:** Web-camera snapshots, face detection alerts, and tab-switch telemetry.

### 1.2 STRIDE Threat Analysis Matrix

| Threat Category | Target Component | Threat Description | Existing Safeguard | Residual Vulnerability / Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | WebSocket Gateway | Student connects with spoofed user ID to join another room | Handshake JWT verification via `TokenService` | Client ID socket rate-limit memory leak (AUD-CON-002) |
| **Tampering** | Judge0 Runner | Student code attempts to modify host root filesystem | Docker containerization | `CAP_SYS_ADMIN` and `no-new-privileges:false` enabled (AUD-SEC-001) |
| **Repudiation** | Examination Submissions | Student denies making a submission | `AuditLog` entity and server-stamped `startedAt`/`completedAt` | Client-side clock drift if client timestamp were trusted (now server-side) |
| **Information Disclosure** | Problems & Catalog API | Student views hidden test cases and reference solutions | Response projection filters (`publicStats`, `codeMap`) | Safe; hidden test cases omitted from public responses |
| **Denial of Service** | Assessment Submit | Mass simultaneous submissions at exam deadline | Redis Throttler (`SmartThrottlerGuard`) | Synchronous code execution in HTTP request handler (AUD-PRF-001) |
| **Elevation of Privilege** | Student Import | Uploaded workbook pollutes Object prototype to gain admin role | Input DTO validation | SheetJS `xlsx: ^0.18.5` vulnerability CVE-2023-30533 (AUD-SEC-002) |

---

## 2. Authentication & Session Security Audit

### 2.1 Password Hashing & Salt Verification
- **Implementation:** `bcryptjs` with cost 10 (`bcrypt.genSalt(10)`).
- **Security Assessment:** Cost 10 satisfies OWASP ASVS Level 2 requirements (minimum 10 rounds for bcrypt).
- **Operational Risk:** Bcrypt is synchronous in JavaScript when multiple hashes are processed; batch student imports cause CPU starvation (AUD-PRF-002).

### 2.2 JWT Token Lifecycle & Rotation
- **Access Tokens:** Signed with HMAC-SHA256 (`HS256`). Lifetime constrained between 15 minutes and 24 hours. Includes `id` and `tv` (tokenVersion).
- **Refresh Tokens:** High-entropy random bytes (48 bytes base64url). Only the SHA-256 hash is persisted in the `refresh_tokens` database table.
- **Family Rotation & Theft Detection:** Tested and confirmed in `backend-nestjs/src/auth/token.service.ts`:
  - When a refresh token is presented, it is marked revoked and replaced.
  - If a revoked token is presented again (indicating token compromise), the entire token family (`familyId`) is revoked immediately, and `user.tokenVersion` is incremented.

### 2.3 Passwordless Login & Registration Disablement
- Public registration (`POST /api/auth/register`) and passwordless OTP login (`POST /api/auth/send-otp`) are explicitly blocked with `BadRequestException('Public registration is currently disabled...')`, preventing unauthorized account creation.

---

## 3. Authorization & Access Control Audit

### 3.1 Object-Level Authorization (BOLA / IDOR)
- **Exam Attempts:** `AssessmentsService.submitAttempt` validates ownership:
  ```typescript
  if (attempt.studentId !== studentId) {
    throw new ForbiddenException('You do not own this assessment attempt');
  }
  ```
- **Contest Attempts:** `ContestsService.submitAttempt` verifies that `contest_id` and `user_id` match the session caller.
- **Reports:** `ReportsController` validates that non-admin students can only download reports where `attempt.studentId === req.user.id`.

### 3.2 Role-Based Access Control (RBAC)
- Admin routes are protected by `AdminGuard` inspecting `req.user.role === 'admin' || req.user.isAdmin === true`.
- Teacher routes are guarded by dedicated role guards.

---

## 4. Code Execution Sandbox Threat Assessment

### 4.1 Piston Runner Architecture
- **Engine:** Piston v2 with Linux `isolate` sandboxing.
- **Host Flags:** Runs with `privileged: true` and `cgroup: host` strictly on a dedicated, non-application host (`deployment/piston/compose.yaml`).
- **Resource Constraints Enforced:**
  - `PISTON_DISABLE_NETWORKING: 'true'` (No outbound network access; prevents port scanning or internal metadata access).
  - `PISTON_RUN_TIMEOUT: '3000'` (3 seconds max execution).
  - `PISTON_RUN_MEMORY_LIMIT: '268435456'` (256MB memory cap).
  - `PISTON_MAX_PROCESS_COUNT: '64'` (Mitigates fork bombs).
  - `PISTON_OUTPUT_MAX_SIZE: '65536'` (64KB stdout cap; prevents disk-filling attacks).

### 4.2 Judge0 Runner Vulnerability (AUD-SEC-001)
- **Vulnerability:** In `terraform/environments/production/userdata/judge0.sh.tftpl`, Docker is executed with:
  ```bash
  --cap-add SYS_ADMIN --security-opt no-new-privileges:false
  ```
- **Risk Analysis:**
  1. `CAP_SYS_ADMIN` allows access to `mount()`, `umount()`, `clone()` with new namespaces, and various privileged sysctls.
  2. If untrusted C code inside Judge0 exploits a known Linux kernel unprivileged user namespace vulnerability, having `CAP_SYS_ADMIN` in the container eliminates the container security boundary.
  3. Recommendation: Eliminate Judge0 or lock down capabilities to `CAP_SETUID`, `CAP_SETGID` only, with `no-new-privileges:true`.

---

## 5. OWASP ASVS v4.0.3 Compliance Checklist

| ASVS Section | Description | Status | Verification Notes |
| :--- | :--- | :---: | :--- |
| **V1: Architecture** | Threat modeling & perimeter defense | **PARTIAL** | Core architecture solid; FinOps/NAT and Judge0 sandbox gaps exist |
| **V2: Authentication** | Password storage, token lifecycle | **PASS** | Bcrypt cost 10, SHA-256 refresh hashing, token families active |
| **V3: Session Mgmt** | Session timeout, revocation, logout | **PASS** | Token versioning invalidates all sessions on logout |
| **V4: Access Control** | Principle of least privilege, IDOR | **PASS** | Server-side ownership validated on attempts, submissions, and reports |
| **V5: Validation** | Input sanitization, parameterized queries | **PASS** | TypeORM parameterized queries; ValidationPipe whitelist enabled |
| **V8: Data Protection** | Sensitive data at rest & transit | **PASS** | TLS 1.3 on ALB, RDS SSL with CA verification, encrypted passwords |
| **V10: Malicious Code** | Untrusted code execution sandboxing | **PARTIAL** | Piston isolated; Judge0 requires capability hardening |
| **V14: Configuration** | Secure defaults, headers, CORS | **PASS** | Helmet enabled; strict origin matching in `cors.util.ts` |
