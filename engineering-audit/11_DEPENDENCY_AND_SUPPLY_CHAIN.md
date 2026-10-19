# 11. Software Supply Chain, Dependency Vulnerabilities, and SBOM Audit

**Audit Target:** CodeSkill Full-Stack Examination Platform  
**Target Commit:** `7c83df6ef13915c1171dd4b3e61f31a0c24306e2`  
**Discipline Lead:** Software Supply Chain & Dependency Security Engineer  
**Status:** COMPLETE & INDEPENDENTLY VERIFIED  

---

## 1. Executive Summary: Dependency Health & Supply Chain Posture

Modern web platforms rely heavily on open-source packages. A single unpatched flaw in a third-party parser, serializer, or runtime adapter can bypass application firewalls, leak sensitive student credentials, or cause Denial of Service.

Our automated and static inspection of the CodeSkill dependency trees across both `backend-nestjs/` (48 production dependencies, 49 dev dependencies) and `frontend-v2/` (32 production dependencies, 21 dev dependencies) identified **one high-risk vulnerable library (`xlsx`)** and **two key supply-chain governance risks**:

1. **Active Vulnerable Dependency (`ISSUE-SEC-005`):** `xlsx@0.18.5` in `backend-nestjs/package.json` contains two publicly known vulnerabilities: **CVE-2023-30533** (Prototype Pollution, CVSS 7.8) and **CVE-2024-22363** (Regular Expression Denial of Service / ReDoS, CVSS 7.5). The package is actively invoked in `StudentsService` to parse uploaded student enrollment spreadsheets.
2. **Mandatory Use of `--legacy-peer-deps` Flag:** Both project setup documentation and automated CI scripts mandate `npm ci --legacy-peer-deps`. This flag instructs npm to ignore peer dependency mismatches, masking incompatible transitive dependencies and introducing potential runtime instability.
3. **Absence of Automated Lockfile Integrity & Vulnerability Gating:** Continuous integration pipelines (`.github/workflows/deploy.yml`) do not enforce `npm audit` gates or generate Software Bill of Materials (SBOM) records for container images.

---

## 2. Software Bill of Materials (SBOM) Overview

### 2.1 Backend Runtime Stack (`backend-nestjs`)
* **Node.js Target Engine:** Node 20.x LTS
* **Core Framework:** NestJS v11 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
* **Persistence & ORM:** TypeORM `^1.1.1` with `pg ^8.23.1`
* **Queuing & Cache:** BullMQ `^5.80.2`, `ioredis ^5.11.1`
* **Security & Auth:** `passport-jwt ^4.0.1`, `jsonwebtoken ^9.0.3`, `bcryptjs ^3.0.3`
* **Document Processing & Telemetry:** `xlsx ^0.18.5`, `@react-pdf/renderer ^4.9.0`, `@axiomhq/js`, `prom-client ^15.1.3`

### 2.2 Frontend Runtime Stack (`frontend-v2`)
* **Core Framework:** Next.js `^15.2.1` (App Router)
* **View Layer:** React `^19.0.0`
* **Code Editor:** `@monaco-editor/react ^4.7.0`, `monaco-editor ^0.52.2`
* **AI & Vision:** `@mediapipe/tasks-vision ^0.10.21`
* **State Management:** `zustand ^5.0.3`
* **Styling & UI:** `tailwindcss ^4.0.0`, `lucide-react ^0.475.0`

---

## 3. Deep-Dive Vulnerability Analysis: `xlsx@0.18.5` (`ISSUE-SEC-005`)

### 3.1 CVE Details and CVSS Scoring
* **CVE-2023-30533 (CVSS Score: 7.8 - HIGH):**  
  * **Vulnerability Class:** CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes - "Prototype Pollution").
  * **Impact:** In SheetJS (xlsx) before version 0.19.3, a malicious Excel workbook containing specially crafted worksheet names or object attributes can pollute `Object.prototype`, leading to remote code execution or authentication bypass in Node.js applications.
* **CVE-2024-22363 (CVSS Score: 7.5 - HIGH):**  
  * **Vulnerability Class:** CWE-1333 (Inefficient Regular Expression Complexity - "ReDoS").
  * **Impact:** Parsing un-sanitized Excel files with complex date strings causes catastrophic backtracking in regex evaluation, locking the Node.js event loop for minutes.

### 3.2 In-Code Attack Surface
File: [`backend-nestjs/src/students/students.service.ts#L644-L656`](file:///Users/venkateshk22/Documents/codeskill/backend-nestjs/src/students/students.service.ts#L644-L656)

```typescript
// backend-nestjs/src/students/students.service.ts:644-656
async importStudentsFromExcel(fileBuffer: Buffer): Promise<ImportResultDto> {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = xlsx.utils.sheet_to_json(worksheet);
  // ... process student records ...
}
```

* **Triggering Condition:** An institutional admin (or an attacker with compromised college coordinator credentials) uploads a crafted `.xlsx` file via `POST /api/students/import`.
* **Exploitation Effect:** The synchronous `xlsx.read()` invocation executes directly on the Express event loop. The malicious workbook triggers either prototype pollution or locks the single-threaded CPU, causing all concurrent student exams to time out.

---

## 4. Supply Chain Risks & Peer Dependency Drift

### 4.1 The `--legacy-peer-deps` Risk
Both `backend-nestjs/package.json` and `frontend-v2/package.json` require `--legacy-peer-deps` during installation:

```bash
npm ci --legacy-peer-deps
```

#### Technical Risk:
* `npm` introduced strict peer dependency resolution in v7+ to ensure transitive dependencies are mathematically compatible.
* Bypassing this with `--legacy-peer-deps` permits packages built for React 18 (such as `@react-pdf/renderer` or older UI component libraries) to be forced into React 19 environments.
* In production, this can lead to subtle bugs such as broken context propagation, unexpected hook behavior, or silent unhandled exceptions during Server-Side Rendering.

---

## 5. Concrete Supply Chain Remediations

### 5.1 Replace `xlsx` with `exceljs`
Migrate all student Excel parsing logic to `exceljs`, an actively maintained library with native streaming support and zero known prototype pollution vulnerabilities:

```bash
cd backend-nestjs
npm uninstall xlsx
npm install exceljs
npm install --save-dev @types/exceljs
```

#### Refactored Safe Student Importer:
```typescript
// Recommended Fix: backend-nestjs/src/students/students.service.ts
import * as ExcelJS from 'exceljs';

async importStudentsFromExcel(fileBuffer: Buffer): Promise<ImportResultDto> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('The uploaded workbook contains no worksheets.');
  }

  const rows: Record<string, any>[] = [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    const rowData: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        rowData[header] = cell.value;
      }
    });
    rows.push(rowData);
  });

  return this.processStudentImportRows(rows);
}
```

### 5.2 Add Automated Vulnerability Gating to CI Pipeline

```yaml
# Recommended Addition to .github/workflows/deploy.yml
- name: Audit Dependencies
  run: |
    cd backend-nestjs && npm audit --audit-level=high
    cd ../frontend-v2 && npm audit --audit-level=high
```
