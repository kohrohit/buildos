# Non-Functional Requirements

> **Instructions**: Define the quality attributes and operational constraints for your system. These are loaded by agents to ensure implementations meet performance, reliability, and operational standards. Update as requirements evolve.

## Performance

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| API response time (reads) | p95 < [200ms] | [APM tool, e.g., Datadog] |
| API response time (writes) | p95 < [500ms] | [APM tool] |
| Database query time | p95 < [50ms] | [Query logging / slow query log] |
| Page load time (LCP) | < [2.5s] | [Lighthouse / Web Vitals] |
| Throughput | [1000] requests/sec | [Load testing tool, e.g., k6] |

## Reliability

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Uptime SLA | [99.9%] ([8.76 hours/year] downtime) | [Uptime monitoring] |
| Error rate | < [0.1%] of requests | [APM / error tracking] |
| Recovery time objective (RTO) | < [1 hour] | [Incident drill testing] |
| Recovery point objective (RPO) | < [5 minutes] of data loss | [Backup frequency verification] |
| Mean time to recovery (MTTR) | < [30 minutes] | [Incident retrospectives] |

## Scalability

| Dimension | Current | Target | Timeframe |
|-----------|---------|--------|-----------|
| Concurrent users | [100] | [10,000] | [12 months] |
| Data volume | [1 GB] | [100 GB] | [12 months] |
| API requests/day | [10K] | [1M] | [12 months] |
| Storage growth rate | [1 GB/month] | [10 GB/month] | [12 months] |

## Security

<!-- Reference governance/skills/security-baseline.md for detailed controls. -->

| Requirement | Standard | Notes |
|-------------|----------|-------|
| Encryption in transit | TLS [1.2+] | [All external and internal communication] |
| Encryption at rest | AES-[256] | [All PII and sensitive data] |
| Authentication | [JWT / Session-based] | [Token expiry: 15 min access, 7 day refresh] |
| Authorization | [RBAC / ABAC] | [Roles: admin, user, viewer] |
| Compliance | [GDPR / SOC2 / HIPAA / None] | [Specific requirements] |

## Observability

| Capability | Tool | Retention |
|-----------|------|-----------|
| Application logs | [e.g., ELK Stack] | [30 days] |
| Metrics | [e.g., Prometheus] | [90 days] |
| Distributed tracing | [e.g., Jaeger] | [7 days] |
| Error tracking | [e.g., Sentry] | [30 days] |
| Uptime monitoring | [e.g., Pingdom] | [12 months] |

## Capacity Planning

| Resource | Current Usage | Threshold | Action |
|----------|--------------|-----------|--------|
| CPU | [30%] | [70%] | [Scale horizontally] |
| Memory | [50%] | [80%] | [Scale vertically or optimize] |
| Database connections | [20/100] | [80/100] | [Increase pool or add read replicas] |
| Disk space | [10 GB / 100 GB] | [80%] | [Archive old data or expand] |

## Deployment

| Requirement | Value |
|-------------|-------|
| Deployment frequency | [Daily / Weekly / On-demand] |
| Deployment window | [Any time / Business hours only] |
| Rollback time | < [5 minutes] |
| Zero-downtime deployments | [Required / Not required] |
| Blue-green / Canary | [Yes / No] |
| Database migration strategy | [Forward-only / Reversible] |
