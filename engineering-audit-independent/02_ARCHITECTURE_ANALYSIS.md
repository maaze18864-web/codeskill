# Architecture Analysis & System Reconstruction

**Platform:** CodeSkill Examination & Online Judge System  
**Repository State:** `f0b6f591b012407137979a39befc9f8b5544ede7`  
**Discipline:** Principal Software Architect & Distributed Systems Engineer

---

## 1. System Context & High-Level Architecture

CodeSkill is structured as a decoupled two-tier application with dedicated background execution nodes and database services.

```mermaid
flowchart TD
    subgraph Clients["Client Tier"]
        Browser["Student / Admin Web Browser\n(React 19 / Next.js 16)"]
        Monaco["Monaco Code Editor\n(Vim / Standard Keymaps)"]
        Proctor["Webcam / MediaPipe / Human.js\nProctoring Stream"]
    end

    subgraph Edge["Edge & Networking (AWS)"]
        Route53["Amazon Route 53\n(codeskill.novaserve.cloud)"]
        ALB["AWS Application Load Balancer\n(HTTPS :443 -> :80)"]
        WAF["AWS WAF v2\n(Rate Limiting & Common Rules)"]
    end

    subgraph AppServers["Application Tier (Private VPC)"]
        NextFrontend["Frontend ASG (Next.js 16 SSR / App Router)\nPort 3000"]
        NestBackend["Backend API ASG (NestJS 11)\nPort 5001"]
        BullWorker["Judge / Queue Worker Process\n(PROCESS_ROLE=judge)"]
    end

    subgraph ExecutionTier["Code Execution Sandbox Tier"]
        CloudMap["AWS Cloud Map Private DNS\n(codeskill.internal)"]
        PistonNode["Piston Runner Node\n(Docker + Isolate, Port 2001)"]
        Judge0Node["Judge0 Runner Node\n(Docker Sandbox, Port 2358)"]
    end

    subgraph DataTier["Data & Cache Tier"]
        RDS["Amazon RDS PostgreSQL 16\n(Multi-AZ db.t3.medium)"]
        RedisCluster["Amazon ElastiCache Redis 7\n(Cluster Mode / BullMQ & PubSub)"]
        S3Bucket["Amazon S3 Bucket\n(Presigned Proctoring & PDFs)"]
    end

    Browser --> Route53
    Route53 --> WAF
    WAF --> ALB
    ALB -->|/api/*| NestBackend
    ALB -->|/*| NextFrontend
    NextFrontend -->|SSR / Direct API| NestBackend
    NestBackend --> RedisCluster
    NestBackend --> RDS
    NestBackend --> BullWorker
    BullWorker --> RedisCluster
    BullWorker --> RDS
    NestBackend --> CloudMap
    CloudMap --> PistonNode
    CloudMap --> Judge0Node
    NestBackend --> S3Bucket
```

---

## 2. Component Architecture & Boundaries

```mermaid
graph TD
    subgraph NestJS["NestJS 11 Application Modules"]
        AuthMod["AuthModule\n(JWT, Refresh Token Family, Scrypt)"]
        AssessMod["AssessmentsModule\n(Exams, MCQ Evaluation, Grading)"]
        ContestMod["ContestsModule\n(Timed Contests, Anti-Cheat, Leaderboards)"]
        ProblemsMod["ProblemsModule\n(Metadata, Statements, Catalogs)"]
        SubmissionsMod["SubmissionsModule\n(Submission Store, Sharding Router)"]
        ExecutionMod["ExecutionModule\n(Admission Control, Piston/Judge0 Provider)"]
        StudentMod["StudentsModule\n(Batch CSV/XLSX Imports, Cryptography)"]
        GatewayMod["GatewayModule\n(Socket.IO, Redis PubSub Adapter)"]
        ObservabilityMod["ObservabilityModule\n(Prometheus /metrics, Axiom Logger)"]
    end

    subgraph StorageEngine["Storage Layer"]
        PrimaryDB[("Primary PostgreSQL DB\n(Users, Contests, Questions)")]
        SubShards[("Submission Shards (Optional)\n(Hash-partitioned Submissions)")]
        RedisStore[("Redis 7\n(BullMQ, Token Throttles, OTP)")]
    end

    SubmissionsMod --> PrimaryDB
    SubmissionsMod -.->|If Enabled| SubShards
    AssessMod --> PrimaryDB
    ContestMod --> PrimaryDB
    AuthMod --> PrimaryDB
    StudentMod --> PrimaryDB
    ExecutionMod --> RedisStore
    GatewayMod --> RedisStore
```

---

## 3. End-to-End Request Lifecycle: Assessment Submission

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Browser
    participant ALB as Application Load Balancer
    participant API as NestJS Backend API
    participant Admission as ExecutionAdmissionService
    participant Queue as BullMQ (Redis)
    participant Worker as Judge Worker
    participant Runner as Piston Execution Sandbox
    participant DB as PostgreSQL (RDS)

    Student->>ALB: POST /api/assessments/:id/submit-attempt (Bearer JWT)
    ALB->>API: Route to NestJS (Port 5001)
    API->>API: Validate JWT & TokenVersion in DB
    API->>DB: Atomic CAS: Update attempt status `in_progress` -> `evaluating`
    
    alt Contains Coding Questions (Current Synchronous Flow)
        API->>Admission: Reserve execution quota
        Admission->>Admission: Issue lease & heartbeat
        API->>Runner: POST /api/v2/execute (Synchronous HTTP)
        Note over API,Runner: HTTP connection blocked while executing test cases!
        Runner-->>API: Test results & execution metrics
        Admission->>Admission: Release lease
    else Contains Only MCQs
        API->>DB: Fetch Question keys & options
        API->>API: Server-side answer evaluation & negative marking
    end

    API->>DB: Update attempt: status='submitted', score, marksAwarded
    API-->>Student: 200 OK (Scorecard & submission status)
```

---

## 4. Authentication, Session & Token Rotation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as Client
    participant API as AuthController / TokenService
    participant DB as PostgreSQL (Users & RefreshTokens)

    User->>API: POST /api/auth/login (email/uid, password)
    API->>DB: Find user by email/uid/username (ILike escaped)
    API->>API: bcrypt.compare(password, user.password)
    API->>DB: Generate familyId; store SHA-256 hash(refreshToken)
    API-->>User: Return accessToken (15m-24h) + refreshToken (raw)

    Note over User,API: Normal API Requests with Bearer accessToken

    User->>API: GET /api/problems (with expired accessToken)
    API-->>User: 401 Unauthorized

    User->>API: POST /api/auth/refresh { refreshToken }
    API->>DB: Lookup token by hash(refreshToken)
    alt Valid and Active
        API->>DB: Mark old token revoked, replace with newToken (same familyId)
        API-->>User: Return new accessToken + new refreshToken
    else Reused Revoked Token (Token Theft Detected!)
        API->>DB: Revoke entire token family (familyId) & increment user.tokenVersion
        API-->>User: 401 Unauthorized (Session Expired, please log in)
    end
```

---

## 5. Deployment and Network Topology

```mermaid
graph TD
    subgraph Internet
        PublicUsers["External Traffic\n(HTTPS :443)"]
    end

    subgraph AWSVPC["AWS VPC (10.0.0.0/16, ap-south-1)"]
        subgraph PublicSubnets["Public Subnets (10.0.1.0/24, 10.0.2.0/24)"]
            ALBInstance["Application Load Balancer\n(Internet-Facing, Multi-AZ)"]
            NAT1["NAT Gateway 1\n(Subnet 1)"]
            NAT2["NAT Gateway 2\n(Subnet 2)"]
        end

        subgraph PrivateAppSubnets["Private App Subnets (10.0.10.0/24, 10.0.11.0/24)"]
            FrontendASG["Frontend ASG Instances\n(Next.js :3000)"]
            BackendASG["Backend ASG Instances\n(NestJS :5001 + BullMQ)"]
            PistonASG["Piston Execution ASG\n(Isolated :2001)"]
            Judge0ASG["Judge0 Execution ASG\n(Isolated :2358)"]
        end

        subgraph PrivateDBSubnets["Private DB Subnets (10.0.20.0/24, 10.0.21.0/24)"]
            RDSPrimary["RDS PostgreSQL 16 Primary\n(db.t3.medium)"]
            RDSStandby["RDS PostgreSQL 16 Standby\n(Multi-AZ)"]
            ElastiCache["ElastiCache Redis 7\n(cache.t4g.small)"]
        end
    end

    PublicUsers --> ALBInstance
    ALBInstance --> FrontendASG
    ALBInstance --> BackendASG
    BackendASG --> NAT1
    BackendASG --> NAT2
    BackendASG --> PistonASG
    BackendASG --> Judge0ASG
    BackendASG --> RDSPrimary
    BackendASG --> ElastiCache
    RDSPrimary -.->|Synchronous Replication| RDSStandby
```

---

## 6. Single Points of Failure & Architectural Weaknesses

### 6.1 Architectural Single Points of Failure (SPOF)
1. **Single Piston/Judge0 Execution Node:**
   While the application ASGs have minimum sizes of 2, the Piston ASG (`min_size = 1`) and Judge0 ASG (`min_size = 1`) each run as a single instance. If the Piston EC2 instance encounters an out-of-memory kernel panic (OOM) from a hostile student loop, all code execution across the platform stops until the ASG health check replaces the node (180s+ delay).
2. **Synchronous Code Execution in HTTP Request Lifecycle:**
   When students submit assessments containing coding problems (`AssessmentsService.submitAttempt`), execution against test cases occurs synchronously within the HTTP handler. A surge of submissions creates an HTTP thread queue, exceeding the ALB 300s idle timeout and dropping student scores.
3. **Primary PostgreSQL Database Writes:**
   All mutations (users, questions, attempts, submissions, audit logs) funnel through the single RDS primary writer instance. Even with submission sharding enabled, all non-submission tables remain on the primary.

### 6.2 Trust Boundaries and Isolation Domains
- **External Client to ALB:** Untrusted. Protected by AWS WAF, TLS 1.3, and CORS policy.
- **ALB to Backend:** Perimeter boundary. Headers (`X-Forwarded-For`, `X-Forwarded-Proto`) trusted only from loopback/local proxies.
- **Backend to Execution Sandbox:** Critical security boundary. Student code runs in isolated containers (Docker + Linux Isolate / cgroups v2).
- **Flaw in Isolation:** The Judge0 runner template grants `CAP_SYS_ADMIN` and `no-new-privileges:false`, weakening this boundary.
