# 06 — Application Security & Threat Modeling Verification Report

This document details the security posture, threat modeling, attack vector mitigations, and automated test verification for all security vulnerabilities remediated in CodeSkill.

---

## 1. Security Vulnerabilities Remediated & Threat Matrix

| Identifier | Vulnerability | OWASP Category | Severity | Pre-Remediation Threat | Post-Remediation State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ISSUE-SEC-001` | Sandbox Escape & IMDSv2 Hop Limit | A05: Security Misconfiguration | **CRITICAL** | Untrusted student code retrieves node IAM credentials via EC2 IMDSv2 | `hop_limit = 1` blocks bridged containers; `--cap-drop ALL` |
| `ISSUE-INF-004` | Wildcard IAM Policy (`Resource: "*"`) | A01: Broken Access Control | **HIGH** | Node role can read/decrypt all AWS account secrets | Policies scoped strictly to `codeskill/production/*` ARNs |
| `ISSUE-SEC-002` | SQL Wildcard `ILIKE` Injection | A03: Injection | **HIGH** | User queries `%` or `_` to authenticate as arbitrary/admin user | Parameter escaping (`escapeIlike`) + exact matching |
| `ISSUE-SEC-003` | Rate-Limiter Spoofed `X-Forwarded-For` | A07: Identification & Auth Failures | **MEDIUM** | Attacker rotates fake IP headers to bypass login throttles | `trust proxy` enabled + right-to-left IP hop validation |
| `ISSUE-SEC-004` | Unencrypted ElastiCache Redis | A02: Cryptographic Failures | **MEDIUM** | In-transit sessions/tokens sniffable on VPC interfaces | Mandatory in-transit (`TLS`) and at-rest encryption |
| `ISSUE-SEC-005` | Spreadsheet Prototype Pollution & DoS | A06: Vulnerable Components | **MEDIUM** | Malicious XLSX file injects formula or overrides `Object.prototype` | Strict parsing flags + recursive `__proto__` stripping |
| `ISSUE-INF-005` | Missing ALB WAF Web ACL Association | A05: Security Misconfiguration | **MEDIUM** | Public load balancer exposed to volumetric DDoS & bot floods | AWS WAF Web ACL associated with production ALB |
| `ISSUE-INF-006` | S3 Missing Encryption & Insecure Transport | A02: Cryptographic Failures | **MEDIUM** | Unencrypted objects at rest & unencrypted HTTP transfer | Bucket-level SSE-S3 (`AES256`) + TLS-only policy |

---

## 2. Threat Vector Deep Dives & Verification

### 2.1 ILIKE Wildcard Sanitization (`ISSUE-SEC-002`)
- **Vulnerability**: TypeORM queries constructed with `ILike(\`%${identifier}%\`)` treated `%` and `_` as SQL pattern wildcards. Passing `identifier = "%"` matched the first record in the database table (often the default platform administrator), allowing password credential verification against arbitrary unintended user accounts.
- **Implemented Fix**:
  ```typescript
  export function escapeIlike(str: string): string {
    return str.replace(/[%_\\]/g, '\\$&');
  }
  ```
  Authentication queries now sanitize identifiers and enforce strict exact matching:
  ```typescript
  const user = await this.userRepository.findOne({
    where: [
      { email: Raw((alias) => `LOWER(${alias}) = LOWER(:id)`, { id: identifier }) },
      { username: Raw((alias) => `LOWER(${alias}) = LOWER(:id)`, { id: identifier }) },
    ],
  });
  ```
- **Automated Test Results** (`backend-nestjs/src/auth/auth.security.spec.ts`):
  ```text
  PASS src/auth/auth.security.spec.ts
    Auth Security & Parameter Sanitization (ISSUE-SEC-002)
      escapeIlike
        ✓ escapes % wildcard character
        ✓ escapes _ single character wildcard
        ✓ escapes backslash characters
        ✓ handles clean strings without modification

  Test Suites: 1 passed, 1 total
  Tests:       4 passed, 4 total
  Snapshots:   0 total
  Time:        0.286 s
  ```

---

### 2.2 Client IP Extraction & Anti-Spoofing (`ISSUE-SEC-003`)
- **Vulnerability**: `SmartThrottlerGuard` extracted client IP via:
  ```typescript
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  ```
  An attacker sending `X-Forwarded-For: 1.2.3.4, ...` caused the throttler to evaluate rate limits against `1.2.3.4`. By rotating the leftmost header value per request, the attacker completely bypassed login brute-force guards.
- **Implemented Fix**:
  1. Configured Express trusted reverse proxy hops in `main.ts`:
     ```typescript
     app.set('trust proxy', 1); // Exactly 1 hop: AWS Application Load Balancer
     ```
  2. Implemented secure right-to-left IP extraction in `smart-throttler.guard.ts`:
     ```typescript
     private extractClientIp(req: Request): string {
       const xForwardedFor = req.headers['x-forwarded-for'];
       if (xForwardedFor) {
         const ips = (Array.isArray(xForwardedFor) ? xForwardedFor.join(',') : xForwardedFor)
           .split(',')
           .map((ip) => ip.trim())
           .filter(Boolean);
         if (ips.length > 0) {
           return ips[ips.length - 1]; // Rightmost IP appended by trusted ALB
         }
       }
       return req.ip || req.socket.remoteAddress || 'unknown';
     }
     ```
- **Automated Test Results** (`backend-nestjs/src/common/guards/smart-throttler.guard.spec.ts`):
  ```text
  PASS src/common/guards/smart-throttler.guard.spec.ts
    SmartThrottlerGuard - IP Anti-Spoofing & Trusted Proxy (ISSUE-SEC-003)
      ✓ should extract rightmost IP when multiple X-Forwarded-For hops exist
      ✓ should fall back to req.ip when no X-Forwarded-For header is present
      ✓ should fall back to socket.remoteAddress when req.ip is empty
      ✓ should generate distinct throttler keys for distinct clients

  Test Suites: 1 passed, 1 total
  Tests:       4 passed, 4 total
  Snapshots:   0 total
  Time:        0.312 s
  ```

---

### 2.3 Hardened Spreadsheet Parsing & Prototype Pollution Defense (`ISSUE-SEC-005`)
- **Vulnerability**: `xlsx` (SheetJS) parsing without security constraints evaluates Excel formula payloads (`=cmd|' /C ...'!A1`) and can pollute `Object.prototype` when converting malicious rows to JSON.
- **Implemented Fix**:
  1. Enforced hardened read options in `students.service.ts` and `questions.service.ts`:
     ```typescript
     const workbook = XLSX.read(file.buffer, {
       type: 'buffer',
       cellFormula: false, // Disallow formula evaluation
       cellHTML: false,    // Disallow raw HTML interpretation
       raw: true,          // Disable formatting evaluation
       dense: true,        // Dense array storage
     });
     ```
  2. Implemented recursive prototype key sanitization on parsed objects:
     ```typescript
     private sanitizeRow(row: any): any {
       if (!row || typeof row !== 'object') return row;
       const clean: any = Array.isArray(row) ? [] : {};
       for (const [key, val] of Object.entries(row)) {
         if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
           continue; // Strip prototype pollution vectors
         }
         clean[key] = val && typeof val === 'object' ? this.sanitizeRow(val) : val;
       }
       return clean;
     }
     ```
- **Automated Test Results** (`backend-nestjs/src/students/students.bulk-import.spec.ts`):
  ```text
  PASS src/students/students.bulk-import.spec.ts
    StudentsService - Bulk Import Hardening (ISSUE-PRF-002 / ISSUE-SEC-005)
      ✓ successfully imports student batch with bounded concurrent hashing
      ✓ enforces hard maximum batch row limit (max 500)
      ✓ strips prototype pollution properties (__proto__, constructor)

  Test Suites: 1 passed, 1 total
  Tests:       3 passed, 3 total
  Snapshots:   0 total
  Time:        0.345 s
  ```

---

### 2.4 Cloud Infrastructure Encryption & Transport Security (`ISSUE-INF-006` / `ISSUE-SEC-004`)
- **S3 Bucket Server-Side Encryption**:
  ```hcl
  resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
    bucket = aws_s3_bucket.storage.id
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256" # $0 KMS cost, fully compliant encryption at rest
      }
    }
  }
  ```
- **S3 TLS-Only Enforcement Policy**:
  ```hcl
  resource "aws_s3_bucket_policy" "enforce_tls" {
    bucket = aws_s3_bucket.storage.id
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.storage.arn,
          "${aws_s3_bucket.storage.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }]
    })
  }
  ```
- **Redis In-Transit Encryption**:
  ElastiCache configuration requires `transit_encryption_enabled = true` and `auth_token` authentication. Backend client connects with `redis_tls = "true"`, encrypting all queue jobs and session payloads traversing the VPC network.
