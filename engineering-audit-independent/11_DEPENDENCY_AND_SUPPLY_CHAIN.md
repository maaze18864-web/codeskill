# Software Supply Chain & Dependency Security Audit

**Platform:** CodeSkill Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** Software Supply Chain & Application Security Engineer

---

## 1. Top-Level Dependency Inventory

### 1.1 Backend (`backend-nestjs/package.json`)
- **Core Runtime:** `@nestjs/core: ^11.0.1`, `@nestjs/common: ^11.0.1`, `express: ^5.0.0`
- **Database & Queue:** `typeorm: ^1.1.1`, `@nestjs/typeorm: ^12.0.2`, `pg: ^8.23.1`, `bullmq: ^5.80.2`, `ioredis: ^5.11.1`
- **Security & Cryptography:** `bcryptjs: ^3.0.3`, `jsonwebtoken: ^9.0.3`, `helmet: ^8.2.0`, `google-auth-library: ^10.9.0`
- **Utilities & Parsing:** `xlsx: ^0.18.5`, `class-validator: ^0.15.1`, `class-transformer: ^0.5.1`, `axios: ^1.18.1`
- **Observability:** `pino: ^10.4.0`, `winston: ^3.19.0`, `prom-client: ^15.1.3`

### 1.2 Frontend (`frontend-v2/package.json`)
- **Core Runtime:** `next: 16.2.9`, `react: 19.2.4`, `react-dom: 19.2.4`
- **Editor & UI:** `monaco-editor: ^0.57.0`, `@monaco-editor/react: ^4.7.0`, `tailwindcss: ^4`, `lucide-react: ^1.51.0`
- **Vision & ML:** `@vladmandic/human: ^3.3.6`, `@mediapipe/tasks-vision: ^1.1.0`
- **State & Network:** `zustand: ^5.0.14`, `axios: ^1.18.1`, `socket.io-client: ^4.8.3`, `idb-keyval: ^6.3.0`

---

## 2. Supply Chain Vulnerability Findings

### 2.1 SheetJS `xlsx: ^0.18.5` (CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6)
- **Severity:** HIGH (CVSS 7.8)
- **Affected Package:** `xlsx` in `backend-nestjs/package.json` line 90.
- **Description:** SheetJS versions `< 0.19.3` are vulnerable to Prototype Pollution and Regular Expression Denial of Service when parsing specially crafted Excel spreadsheets.
- **Usage Context in CodeSkill:**
  In `backend-nestjs/src/students/students.service.ts` (line 370), `xlsx.read(file.buffer)` is used to parse student import rosters uploaded by university instructors and administrators.
- **Remediation:**
  Migrate to the official SheetJS package hosted on SheetJS's secure registry (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) or replace workbook parsing with `exceljs` with hardened cell validation.

### 2.2 React 19 Peer Dependency Compatibility
- `backend-nestjs` installs `@react-pdf/renderer: ^4.9.0` and `react: ^19.3.0`.
- During `npm install`, `--legacy-peer-deps` is required because some PDF sub-dependencies expect React 18 peer signatures.
- **Evaluation:** Runtime PDF generation for examination certificates and student report cards operates safely under React 19 in Node.js, but peer dependency flags must be maintained in CI scripts (`.github/workflows/deploy.yml`).

---

## 3. Supply Chain Hardening Recommendations

1. **Lockfile Integrity:** Maintain `package-lock.json` in source control and enforce `npm ci` in all CI/CD deployment pipelines rather than `npm install`.
2. **Container Base Image Pinning:** Ensure all Dockerfiles pin base images by immutable digest (SHA-256) rather than floating tags like `node:20-alpine`.
3. **Execution Sandbox Packages:** Piston runtime packages (`scripts/piston/upstream.lock`) must pin verified compiler binaries (GCC 10.2, Python 3.10, Node 18).
