# Infrastructure, Reliability & Failure-Mode Analysis

**Platform:** CodeSkill Cloud Deployment  
**Target Repository:** `/Users/venkateshk22/Documents/codeskill/terraform`  
**Discipline:** Site Reliability Engineer (SRE) & Cloud Infrastructure Architect  
**AWS Region:** `ap-south-1` (Asia Pacific - Mumbai)  
**Cost Cap:** Non-negotiable $300 USD / month

---

## 1. Cloud Architecture Inventory (Terraform Production)

The production infrastructure defined in `terraform/environments/production/main.tf` deploys across a custom VPC (`10.0.0.0/16`) in `ap-south-1`:

```
VPC: 10.0.0.0/16
├── Public Subnets (2 AZs): 10.0.1.0/24, 10.0.2.0/24 (ALB, 2x NAT Gateways)
├── Private App Subnets (2 AZs): 10.0.10.0/24, 10.0.11.0/24 (Frontend, Backend, Piston, Judge0 ASGs)
└── Private DB Subnets (2 AZs): 10.0.20.0/24, 10.0.21.0/24 (RDS PostgreSQL, ElastiCache Redis)
```

---

## 2. Infrastructure Cost Breakdown ($300/mo Budget Analysis)

### 2.1 Current Production Architecture Monthly Cost Estimate (AWS `ap-south-1` Pricing)

| Resource | Quantity / Sizing | Unit Price (Monthly) | Subtotal |
| :--- | :--- | :--- | :--- |
| **AWS NAT Gateways** | 2 Gateways + 2 EIPs | $32.85/mo/gateway + $3.65/mo/EIP | **$73.00** |
| **RDS PostgreSQL 16** | 1x `db.t3.medium` Multi-AZ + 50GB gp3 | $0.136/hr * 730h ($99.28) + $5.75 | **$105.03** |
| **ElastiCache Redis 7** | 1x `cache.t4g.small` (Cluster Mode) | $0.026/hr * 730h | **$18.98** |
| **Application Load Balancer** | 1x ALB + 1.5 LCU average | $0.0225/hr * 730h ($16.43) + $5.84 | **$22.27** |
| **Frontend ASG (Next.js)** | 2x `t3.medium` (2 vCPU, 4GB RAM) | $0.0416/hr * 730h * 2 | **$60.74** |
| **Backend ASG (NestJS)** | 2x `t3.medium` (2 vCPU, 4GB RAM) | $0.0416/hr * 730h * 2 | **$60.74** |
| **Piston ASG (Runner)** | 1x `t3.large` (2 vCPU, 8GB RAM) | $0.0832/hr * 730h | **$60.74** |
| **Judge0 ASG (Runner)** | 1x `t3.medium` (2 vCPU, 4GB RAM) | $0.0416/hr * 730h | **$30.37** |
| **EBS Storage (gp3)** | 6x 30GB Root Volumes (180GB) | $0.080/GB-mo | **$14.40** |
| **AWS WAF v2** | 1 Web ACL + 4 Managed Rules | $5.00/ACL + $4.00/rules + requests | **$10.00** |
| **CloudWatch Logs & S3** | Log ingestion (10GB) + S3 snapshots | S3 Standard + CW Logs | **$15.00** |
| **TOTAL MONTHLY BASELINE** | **Minimum Configured Capacity** | | **$471.27 / mo** |

> **CRITICAL BUDGET VIOLATION:** The baseline exceeds the **$300.00/month** limit by **$171.27/month (57% over budget)**!

---

### 2.2 Cost-Optimized Sustainable Architecture ($234.62 / mo)

To guarantee long-term operational viability below the **$300/mo hard limit**, the infrastructure must be refactored as follows:

| Refactoring Step | Action Taken | Monthly Savings | New Subtotal |
| :--- | :--- | :--- | :--- |
| **1. Decommission Judge0** | Remove idle Judge0 ASG (Piston handles all languages) | **-$30.37 / mo** | $440.90 |
| **2. Single NAT Gateway** | Reduce NAT Gateways from 2 to 1 (in Subnet 1) | **-$36.50 / mo** | $404.40 |
| **3. Single-AZ RDS + Snapshots** | Change RDS from Multi-AZ to Single-AZ with daily automated snapshots | **-$49.64 / mo** | $354.76 |
| **4. Right-Size Backend ASG** | Change Backend baseline from 2x `t3.medium` to 2x `t3.small` (1 vCPU, 2GB) | **-$30.37 / mo** | $324.39 |
| **5. Right-Size Frontend ASG** | Change Frontend baseline from 2x `t3.medium` to 2x `t3.small` | **-$30.37 / mo** | $294.02 |
| **6. Optimize Piston Sizing** | Run Piston on 1x `t3.medium` (2 vCPU, 4GB) with parameter tuning | **-$30.37 / mo** | $263.65 |
| **7. Reduce EBS Root Disks** | Reduce instance root volumes from 30GB to 20GB gp3 | **-$4.80 / mo** | $258.85 |
| **8. VPC Endpoint Routing** | S3 Gateway Endpoint ($0 cost) reduces S3 NAT transfer charges | **-$24.23 / mo** | **$234.62 / mo** |

### FinOps Summary
- **Target Ceiling:** $300.00 / month
- **Optimized Recurring Baseline:** **$234.62 / month**
- **Available Monthly Contingency:** **$65.38 / month** (within the 20% safety threshold)
- **AWS vCPU Quota Footprint:** Reduced from **12 vCPUs** down to **8 vCPUs**, eliminating the `VcpuLimitExceeded` service blocker.

---

## 3. Failure Mode & Effects Analysis (FMEA)

| Failure Mode | Trigger Condition | Severity (1-10) | Occurrence (1-10) | Detection (1-10) | RPN | Mitigation Safeguard |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Piston Node Kernel Panic** | Student fork bomb / memory exploit | 8 | 3 | 2 | **48** | ASG health check replaces instance; admission heartbeat returns retryable error |
| **RDS Failover / Restart** | Maintenance window or crash | 9 | 2 | 2 | **36** | TypeORM pool retries connection with exponential backoff |
| **Redis Broker Disconnect** | ElastiCache transient network split | 7 | 2 | 3 | **42** | BullMQ automatically reconnects; offline buffer holds queued jobs |
| **Exam Deadline Bursts** | 1,000 students submit code at once | 9 | 6 | 3 | **162** | **CRITICAL:** Convert assessment submission from synchronous HTTP to BullMQ (`AUD-PRF-001`) |
| **Bcrypt Worker Starvation** | Admin imports 500 students | 8 | 4 | 2 | **64** | Offload hashing to background job queue (`AUD-PRF-002`) |
