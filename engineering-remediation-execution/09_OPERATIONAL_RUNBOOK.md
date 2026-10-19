# 09 — Production SRE & Operational Incident Runbook

This document provides operational instructions, incident response playbooks, disaster recovery procedures, and routine maintenance protocols for CodeSkill engineering teams.

---

## 1. Automated Alarms & Incident Response Matrix

CodeSkill monitors core platform health through 4 native AWS CloudWatch metric alarms routing to `aws_sns_topic.alerts.arn` (`ISSUE-INF-010`):

| Alarm Name | Metric & Threshold | Severity | Immediate Impact | Primary Runbook Action |
| :--- | :--- | :--- | :--- | :--- |
| `codeskill-prod-rds-high-cpu` | `CPUUtilization > 80%` for 2 periods (10 min) | **P1 - CRITICAL** | API query degradation, lock contention | Check long-running queries; review active exam submissions |
| `codeskill-prod-rds-low-storage` | `FreeStorageSpace < 5,000,000,000 bytes` (5 GB) | **P1 - CRITICAL** | Risk of database write halt / read-only state | Increase allocated storage or trigger table vacuuming |
| `codeskill-prod-alb-high-5xx` | `HTTPCode_Target_5XX_Count > 10` (5 min) | **P2 - HIGH** | User-facing API errors, dropped requests | Inspect backend Winston/Axiom error logs; check ASG health |
| `codeskill-prod-redis-high-cpu` | `EngineCPUUtilization > 75%` for 2 periods (10 min) | **P2 - HIGH** | BullMQ queue latency, delayed Socket.IO packets | Inspect Redis slowlog; check for un-indexed keys or queue floods |

---

## 2. Incident Playbooks

### 2.1 Playbook A: RDS CPU Saturation (> 80%)
1. **Connect to PostgreSQL Primary**:
   ```bash
   psql "$DATABASE_URL"
   ```
2. **Identify Long-Running or Blocked Queries**:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
     AND state != 'idle'
   ORDER BY duration DESC;
   ```
3. **Terminate Offending Connection (if query is runaway)**:
   ```sql
   SELECT pg_cancel_backend(pid); -- Graceful cancel
   SELECT pg_terminate_backend(pid); -- Immediate kill
   ```
4. **Verify Connection Pool Health**:
   Ensure active connection count is within bounds:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
   (Should remain strictly $\le 120$ connections across all backend nodes).

---

### 2.2 Playbook B: Elevated BullMQ Queue Backlog (Slow Grading)
1. **Inspect Queue Status in Redis**:
   ```bash
   redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD --tls
   LLEN "bull:submissions:wait"
   LLEN "bull:submissions:active"
   ```
2. **Check Piston / Judge0 Execution Host Health**:
   Query Cloud Map service discovery to verify active judge nodes:
   ```bash
   aws servicediscovery discover-instances \
     --namespace-name codeskill.internal \
     --service-name piston
   ```
3. **Scale Out Execution ASG Manually (Emergency Burst)**:
   ```bash
   aws autoscaling set-desired-capacity \
     --auto-scaling-group-name codeskill-piston-asg \
     --desired-capacity 4
   ```
4. **Inspect Node Systemd Logs**:
   ```bash
   journalctl -u piston -n 100 --no-pager
   ```

---

### 2.3 Playbook C: EC2 Instance Refresh & Zero-Downtime Rollout
When updating Docker images or launch template AMI versions:
1. **Trigger ASG Instance Refresh**:
   ```bash
   aws autoscaling start-instance-refresh \
     --auto-scaling-group-name codeskill-backend-asg \
     --preferences '{"MinHealthyPercentage": 100, "InstanceWarmup": 120}'
   ```
2. **Monitor Refresh Progress**:
   ```bash
   aws autoscaling describe-instance-refreshes \
     --auto-scaling-group-name codeskill-backend-asg
   ```
3. **Rollback Refresh (if 5XX alarms fire)**:
   ```bash
   aws autoscaling cancel-instance-refresh \
     --auto-scaling-group-name codeskill-backend-asg
   ```

---

## 3. Database Backup & Disaster Recovery (DR)

### 3.1 Automated Snapshot Schedule
- RDS creates automated daily snapshots with a 7-day retention period.
- Point-in-Time Recovery (PITR) is enabled with 5-minute recovery granularity.

### 3.2 Manual Pre-Maintenance Backup
Before executing any DDL schema change or shard migration:
```bash
aws rds create-db-snapshot \
  --db-instance-identifier codeskill-prod-postgres \
  --db-snapshot-identifier "pre-migration-$(date +%Y%m%d%H%M)"
```

### 3.3 Point-in-Time Restoration
To restore database state to a specific timestamp (e.g., 20 minutes prior):
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier codeskill-prod-postgres \
  --target-db-instance-identifier codeskill-prod-postgres-restored \
  --restore-time "2026-10-19T05:45:00Z" \
  --db-instance-class db.t4g.small \
  --vpc-security-group-ids sg-xxxxxx \
  --db-subnet-group-name codeskill-prod-db-subnets
```

---

## 4. Secret & Credential Rotation Protocol

All secrets are managed via AWS Secrets Manager with zero hardcoded credentials:
1. **JWT Secret Rotation**:
   - `JWT_SECRET` must be at least 32 characters with high entropy.
   - To rotate without invalidating active exams, support dual-secret verification in `jwt.strategy.ts` during a 24-hour transition window.
2. **Database Password Rotation**:
   - Update master password in AWS Secrets Manager:
     ```bash
     aws secretsmanager update-secret --secret-id codeskill/production/database --secret-string '{"password":"..."}'
     ```
   - Update RDS instance credentials with `--apply-immediately`.
   - Trigger instance refresh on Backend ASG to ingest updated credentials.
