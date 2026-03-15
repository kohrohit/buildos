# Architecture Discovery — Adaptive System Design Questionnaire

## Purpose

Before any roadmap is created, determine the **grade** of the system being built and ask
the right architectural questions at the right depth. A PoC doesn't need CQRS discussions.
An enterprise system can't skip capacity planning. This skill ensures the architecture
guardrails are proportional to the stakes.

## When to Use

Invoke at the START of `/build:plan`, before defining any epics. The output feeds directly
into `brain/architecture.md` and `brain/nfrs.md`.

---

## Step 1: Classify the System Grade

Ask the user:

> **What grade of system are you building?**
>
> 1. **Prototype/PoC** — Validate an idea. Throwaway code. Speed over quality.
> 2. **MVP** — Ship to real users. Needs to work, not scale. Iterate fast.
> 3. **Production** — Revenue-generating. Reliability matters. Users depend on it.
> 4. **Enterprise** — High availability, compliance, audit trails, multi-tenant, SLAs.
> 5. **Mission-Critical** — Financial systems, healthcare, infrastructure. Zero tolerance for failure.

If the user describes their project instead of picking a number, classify it yourself and
confirm with them.

---

## Step 2: Ask Grade-Appropriate Questions

### All Grades (always ask)

| # | Question | Feeds Into |
|---|----------|-----------|
| 1 | What does the system do in one sentence? | `architecture.md` → System Overview |
| 2 | Who are the users? (developers, end-users, internal ops, APIs) | Module boundaries |
| 3 | What's the tech stack preference? (language, framework, database, or "recommend") | `architecture.md` → Technology Stack |
| 4 | Any hard constraints? (cloud provider, compliance, existing systems to integrate) | Architectural Constraints |

### MVP+ (grade 2+)

| # | Question | Feeds Into | Informed By |
|---|----------|-----------|-------------|
| 5 | How many concurrent users do you expect in 6 months? | `nfrs.md` → Scalability | Art of Scalability — AKF Scale Cube |
| 6 | What data does the system store? Any PII or sensitive data? | Security posture, encryption requirements | DDIA — data models |
| 7 | Does the system need to work offline or handle unreliable networks? | Architecture pattern choice | DDIA — partitioning |
| 8 | What's your deployment target? (single server, containers, serverless, managed PaaS) | Deployment architecture | Building Microservices — deployment |

### Production+ (grade 3+)

| # | Question | Feeds Into | Informed By |
|---|----------|-----------|-------------|
| 9 | What's your target uptime? (99%, 99.9%, 99.99%) | `nfrs.md` → Reliability, error budgets | Google SRE — SLOs and error budgets |
| 10 | What's your peak transactions per second (TPS)? Or expected API calls/day? | `nfrs.md` → Performance, capacity planning | Art of Scalability — capacity models |
| 11 | What's your acceptable data loss window? (RPO: 0, 5min, 1hr, 24hr) | Backup strategy, replication | DDIA — replication and durability |
| 12 | How should the system handle failures? (retry, circuit-break, degrade gracefully, fail fast) | Error handling patterns | Building Microservices — resilience |
| 13 | Do you need real-time features? (websockets, SSE, push notifications) | Architecture pattern (event-driven?) | Streaming Systems — real-time processing |
| 14 | What's your observability requirement? (logs only, metrics+logs, full tracing) | `nfrs.md` → Observability | Google SRE — monitoring |

### Enterprise+ (grade 4+)

| # | Question | Feeds Into | Informed By |
|---|----------|-----------|-------------|
| 15 | Multi-tenant or single-tenant? If multi-tenant, isolation model? (shared DB, schema-per-tenant, DB-per-tenant) | Data architecture, module boundaries | Patterns of Enterprise Application Architecture |
| 16 | What compliance standards apply? (GDPR, SOC2, HIPAA, PCI-DSS, none yet) | Security, audit, data handling | Security baseline |
| 17 | Do you need audit trails? (who did what, when, from where) | Cross-cutting concerns | Enterprise patterns — audit logging |
| 18 | What's your API strategy? (internal only, public API, partner API, API marketplace) | API versioning, rate limiting, documentation | REST API best practices |
| 19 | Do you need RBAC, ABAC, or custom authorization? How many roles? | Auth architecture | Building Microservices — security |
| 20 | What's your data residency requirement? (single region, multi-region, specific countries) | Deployment topology | DDIA — partitioning, replication |
| 21 | Do you need blue-green or canary deployments? | Deployment pipeline | Google SRE — release engineering |

### Mission-Critical (grade 5)

| # | Question | Feeds Into | Informed By |
|---|----------|-----------|-------------|
| 22 | What's the cost of 1 hour of downtime? (reputation, revenue, regulatory fine) | SLA strictness, redundancy investment | Google SRE — risk and error budgets |
| 23 | Do you need strong consistency or is eventual consistency acceptable? Where? | Data architecture, consensus protocols | DDIA — consistency models, MIT 6.824 — linearizability |
| 24 | What's your disaster recovery strategy? (active-active, active-passive, cold standby) | Infrastructure architecture | Art of Scalability — fault tolerance |
| 25 | Do you need formal change management? (approval workflows, change windows) | Deployment governance | Google SRE — release engineering |
| 26 | What are your data retention and destruction policies? | Storage architecture, compliance | Regulatory requirements |
| 27 | Do you need idempotent operations? Which ones? | API design, message processing | DDIA — exactly-once semantics |

---

## Step 3: Provide Recommendations (don't just collect answers)

After gathering answers, provide **opinionated recommendations** for each area. Don't just
record what the user said — challenge assumptions and suggest alternatives.

### Architecture Pattern Recommendation

Based on the grade and answers, recommend one of:

| Grade | Likely Pattern | When to Deviate |
|---|---|---|
| PoC | **Monolith** (single file/module is fine) | Never — complexity kills PoCs |
| MVP | **Modular Monolith** (clean boundaries, single deployment) | If team is distributed across services already |
| Production | **Modular Monolith** or **Service-Oriented** (2-4 services max) | If distinct scaling needs exist per domain |
| Enterprise | **Service-Oriented** or **Microservices** (bounded contexts) | If team size < 5, stay monolith |
| Mission-Critical | **Event-Driven Microservices** with **CQRS** where needed | If data volume is low, CQRS is overhead |

### Technology Recommendations

If the user said "recommend", suggest based on:

| Concern | Recommendation | Why |
|---|---|---|
| General web backend | **Go** or **TypeScript (Node)** | Go for performance-critical; TS for rapid development |
| Data-heavy system | **PostgreSQL** + **Redis** | Battle-tested, ACID, rich query language |
| Event-driven | **Kafka** or **NATS** | Kafka for durability; NATS for simplicity |
| Real-time | **WebSockets** via framework-native or **SSE** | SSE simpler if uni-directional |
| High TPS (>10K/s) | **Go** or **Rust** backend | JVM startup overhead matters at scale |
| Enterprise auth | **OIDC** + **Keycloak** or managed (Auth0, Cognito) | Don't build auth from scratch |

### NFR Auto-Population

Based on grade, auto-fill `nfrs.md` with sensible defaults:

| NFR | PoC | MVP | Production | Enterprise | Mission-Critical |
|---|---|---|---|---|---|
| Uptime SLA | N/A | 99% | 99.9% | 99.95% | 99.99% |
| API p95 latency | No target | <1s | <200ms | <100ms | <50ms |
| Error rate | No target | <5% | <0.1% | <0.05% | <0.01% |
| RTO | N/A | <24hr | <1hr | <15min | <5min |
| RPO | N/A | <24hr | <5min | <1min | 0 (zero data loss) |
| Test coverage | 0% | 50% | 80% | 90% | 95%+ |
| Security | None | HTTPS + basic auth | OWASP Top 10 | SOC2-ready | Full compliance |
| Observability | Console logs | Structured logs | Logs + metrics | Logs + metrics + tracing | Full + alerting + runbooks |
| Deployment | Manual | CI/CD | CI/CD + staging | Blue-green/canary | Blue-green + approval gates |

---

## Step 4: Generate Architecture Artifacts

After discovery, automatically generate or populate:

1. **`brain/architecture.md`** — Fill in system overview, architecture style, component diagram, tech stack, module boundaries, cross-cutting concerns, constraints
2. **`brain/nfrs.md`** — Fill in performance targets, reliability targets, scalability projections, security requirements, observability stack, deployment requirements
3. **ADR-001: Architecture Grade and Pattern** — Record the grade classification and pattern choice as the first ADR

---

## Step 5: Innovative Additions (beyond the books)

### Architecture Fitness Functions

For Production+ grades, define **automated checks** that validate architecture properties:

```
fitness_functions:
  - name: "No cross-boundary imports"
    check: "grep -r 'import.*from.*@module/' src/ | check_boundaries"
    frequency: "every commit"

  - name: "API response time budget"
    check: "run_load_test --p95-threshold=${nfr.api_latency}"
    frequency: "every deploy"

  - name: "Dependency direction"
    check: "validate_dependency_graph --no-upward-deps"
    frequency: "every commit"
```

### Scale Triggers (not just targets)

Instead of static NFRs, define **when to act**:

```
scale_triggers:
  - metric: "CPU > 70% for 5 minutes"
    action: "Add horizontal instance"
    grade: "Production+"

  - metric: "DB connections > 80% pool"
    action: "Add read replica or increase pool"
    grade: "Enterprise+"

  - metric: "Error budget burned > 50% in first week"
    action: "Freeze features, focus reliability"
    grade: "Production+"
```

### Architecture Decay Detection

For Enterprise+ grades, check for **architecture erosion** each sprint:

- Module coupling score (should decrease or stay flat, never increase)
- Dependency count per module (flag if growing faster than features)
- API surface area growth (flag unplanned public endpoints)
- Test-to-code ratio per module (flag modules where ratio is dropping)

### Cost-Aware Architecture

Ask about budget constraints. A $50/month AWS bill has different architecture than $50K/month:

| Monthly Budget | Architecture Implication |
|---|---|
| <$100 | Single instance, SQLite/PostgreSQL, no Redis, no queue |
| $100-$1K | Small cluster, managed DB, basic queue |
| $1K-$10K | Multi-AZ, read replicas, CDN, managed services |
| $10K+ | Multi-region, dedicated instances, full observability stack |

---

## Output

After completing discovery, summarize:

```
Architecture Discovery Complete
  Grade: {grade}
  Pattern: {pattern} — {rationale}
  Tech Stack: {language} / {framework} / {database}

  Key Decisions:
    - {decision 1}
    - {decision 2}
    - {decision 3}

  NFRs Auto-Populated: {n} targets set
  Fitness Functions: {n} defined
  Scale Triggers: {n} configured

  Artifacts Generated:
    - brain/architecture.md (populated)
    - brain/nfrs.md (populated)
    - brain/adr/001-architecture-grade.md (created)

  Next: Continue with epic definition in /build-plan
```
