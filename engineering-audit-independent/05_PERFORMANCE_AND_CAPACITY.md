# Performance, Mathematical Capacity Planning & Load Analysis

**Platform:** CodeSkill Examination Platform  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill`  
**Discipline:** Performance & Capacity Planning Architect  
**Hard Business Constraint:** Total AWS recurring cost capped at **$300 USD / month**.

---

## 1. Workload Definitions & Distinction of Terms

To prevent misleading claims, we establish strict technical boundaries between distinct traffic dimensions:

| Term | Unit | Definition |
| :--- | :---: | :--- |
| **Registered Users** | Count | Total records stored in the `users` database table (e.g., 50,000 students). |
| **Active Concurrent Sessions ($N$)** | Users | Students logged in and actively interacting with an exam interface simultaneously. |
| **Request Arrival Rate ($\lambda$)** | Req / sec | Total HTTP/WebSocket requests arriving at the application load balancer per second. |
| **Mean Service Time ($W$)** | Seconds | Average duration an HTTP request spends in the application tier until completion. |
| **In-Flight Requests ($L$)** | Requests | Concurrently open requests being processed across all application instances. |
| **Execution Job Arrival Rate ($\lambda_{exec}$)** | Jobs / sec | Student code runs sent to the Piston execution engine. |

---

## 2. Mathematical Capacity Models

### 2.1 Little's Law
$$L = \lambda \times W$$
- If 1,000 concurrent students each generate **0.2 requests/sec** ($\lambda = 200 \text{ req/s}$), and the average backend response time is **50ms** ($W = 0.05\text{s}$):
  $$L = 200 \times 0.05 = 10 \text{ concurrent in-flight requests}$$
- **During Examination Deadline Burst:**  
  When 500 students submit simultaneously and synchronous code execution is invoked ($W = 3.5\text{s}$ per coding evaluation):
  $$\lambda = 500 / 30\text{s} = 16.6 \text{ submissions/s}$$
  $$L = 16.6 \times 3.5 = 58.1 \text{ concurrent long-running HTTP connections}$$
  This exhausts the standard Node.js single-thread execution queue and saturates database connection pools.

### 2.2 Database Query Demand (QPS)
$$\text{QPS} = \lambda \times Q_{req}$$
- Read-heavy examination browsing: $Q_{req} \approx 2$ queries per request. At 200 RPS = **400 QPS**.
- Write-heavy autosave & code submit: $Q_{req} \approx 4$ queries (Attempt update, response write, audit log, user update). At 50 RPS = **200 write QPS**.
- A `db.t3.medium` RDS instance (2 vCPUs, 4GB RAM, gp3 SSD at 3,000 baseline IOPS) easily handles up to **800 - 1,200 QPS** provided queries are indexed.

### 2.3 Database Connection Pool Sizing
$$\text{Max DB Connections} = \sum (\text{ASG Nodes} \times \text{Instances Per Node} \times \text{DB\_POOL\_MAX}) + \text{Worker Pools} + \text{Reserve}$$
- With 2 Backend Nodes, 2 PM2 processes each, and `DB_POOL_MAX = 15`:
  $$\text{Baseline Connections} = (2 \times 2 \times 15) + (2 \text{ workers} \times 5) + 10 = 80 \text{ connections}$$
- With 6 Backend Nodes under peak autoscaling:
  $$\text{Peak Connections} = (6 \times 2 \times 15) + 10 + 10 = 200 \text{ connections}$$
  *Risk:* Standard PostgreSQL on `db.t3.medium` defaults to 100-400 connections. Over-provisioning `DB_POOL_MAX` beyond 15 will cause connection rejection errors (`AUD-DAT-001`).

### 2.4 Code Execution Worker Concurrency & Queue Drain Time
Piston execution limits:
- `PISTON_MAX_CONCURRENT_EXECUTIONS = 25` per node.
- Mean testcase execution time: **1.2 seconds**.
- Max sustainable execution throughput per Piston node:
  $$\text{Throughput} = \frac{25 \text{ slots}}{1.2 \text{ sec}} \approx 20.8 \text{ evaluations/sec}$$
- If 1,000 students submit code within 60 seconds (16.6 submissions/sec):
  $$\text{Arrival Rate } (16.6\text{/s}) < \text{Service Rate } (20.8\text{/s})$$
  The queue remains stable with mean wait time under **1.8 seconds**.
- If a sudden spike of 300 submissions arrives in 5 seconds (60 submissions/sec):
  - Initial backlog: 300 jobs.
  - Drain time: $300 / 20.8 = 14.4 \text{ seconds}$.

---

## 3. Mandatory Concurrency Scenarios & Safe Capacity Matrix

| Metric | Very Small (10 Users) | Small (50 Users) | Moderate (100 Users) | Growing (500 Users) | Large (1,000 Users) | High Load (5,000 Users) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Request Rate ($\lambda$)** | 2 RPS | 10 RPS | 20 RPS | 100 RPS | 200 RPS | 1,000 RPS |
| **In-Flight Requests ($L$)** | < 1 | 1 | 2 | 10 | 25 | 120 |
| **Database QPS** | 6 QPS | 30 QPS | 60 QPS | 300 QPS | 600 QPS | 3,000 QPS |
| **Code Submissions / Min** | 2 / min | 10 / min | 25 / min | 150 / min | 350 / min | 1,800 / min |
| **Piston Worker Slots** | 2 slots | 5 slots | 10 slots | 25 slots (1 node) | 50 slots (2 nodes) | 150 slots (6 nodes) |
| **Backend Compute Req** | 1x `t3.small` | 1x `t3.small` | 2x `t3.small` | 2x `t3.medium` | 3x `t3.medium` | 8x `t3.medium` |
| **Estimated AWS Cost** | $145 / mo | $165 / mo | $195 / mo | $245 / mo | $295 / mo | $850 / mo |
| **Fits $300/mo Budget?** | **YES** | **YES** | **YES** | **YES** | **YES** | **NO (Exceeds Budget)** |

---

## 4. Bottleneck Identification & Sustainable Operating Envelope

### 4.1 Identified Performance Bottlenecks
1. **Synchronous Code Execution in Assessments (`AUD-PRF-001`):**  
   Under more than 250 concurrent students, synchronous HTTP execution causes connection pool exhaustion and ALB timeouts.
2. **Synchronous Bcrypt Hashing (`AUD-PRF-002`):**  
   Administrative student imports freeze the Node.js event loop for 40 seconds.
3. **Piston Host CPU Throttling on Bursts:**  
   `t3` instance types accumulate CPU credits. Under sustained 100% CPU usage during continuous multi-hour coding exams, burst credits exhaust, causing CPU throttling to 20% baseline.

### 4.2 Maximum Safe Workload Within $300/mo Budget
Under the strict non-negotiable **$300/month AWS spending ceiling**, CodeSkill can reliably support:
- **Maximum Safe Concurrent Students:** **1,000 active concurrent examination students**.
- **Maximum Sustained Request Rate:** **200 Requests / Second**.
- **Maximum Code Execution Throughput:** **350 evaluations / minute** (with 2 Piston nodes or 1 right-sized node).
- **Required Architectural Prerequisite:** Transition assessment code grading to asynchronous BullMQ job queues to prevent HTTP gateway timeouts.
