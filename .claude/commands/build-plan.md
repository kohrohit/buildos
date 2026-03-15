---
description: "Create or update project roadmap with epics, modules, and dependencies"
---

# /build-plan — Roadmap Planning

## Purpose
Read the governance brain and project context, then create or refine a roadmap with epics, modules, dependencies, and sprint candidates. Produces a structured plan that drives all subsequent sprints.

**Before any epic is defined, architecture discovery MUST happen first.** The system grade determines the depth of every subsequent decision.

## Context Pack
Load: `governance/core-policies.md`, `governance/architecture-principles.md`, `context/planning-context.md`

Also load: `state/current-project.json`, `state/roadmap.json`, `state/learned-patterns.json`

## Steps

### Phase 0: Architecture Discovery (MANDATORY for new projects)

Skip this phase ONLY if `brain/architecture.md` is already populated (not placeholder templates).

1. **Classify system grade**
   - Follow `governance/skills/architecture-discovery.md`
   - Ask: "What grade of system are you building?" (PoC → MVP → Production → Enterprise → Mission-Critical)
   - If user describes instead of classifying, classify for them and confirm

2. **Ask grade-appropriate questions**
   - All grades: system purpose, users, tech stack, constraints
   - MVP+: concurrency, data sensitivity, deployment target
   - Production+: uptime SLA, TPS, RPO, failure handling, observability
   - Enterprise+: multi-tenancy, compliance, audit trails, API strategy, RBAC, data residency
   - Mission-Critical: downtime cost, consistency model, DR strategy, change management, idempotency
   - Also ask: **monthly infrastructure budget** (shapes architecture choices)

3. **Provide opinionated recommendations**
   - Recommend architecture pattern based on grade (don't just ask, suggest with rationale)
   - Recommend tech stack if user is open (grounded in reference knowledge)
   - Challenge assumptions: if user says "microservices" for a 2-person team, push back
   - Recommend based on principles from: DDIA, SRE, Art of Scalability, Building Microservices

4. **Generate architecture artifacts**
   - Populate `brain/architecture.md` — system overview, pattern, component diagram, tech stack, module boundaries, cross-cutting concerns, constraints
   - Populate `brain/nfrs.md` — auto-fill from grade defaults, override with user answers
   - Create `brain/adr/001-architecture-grade.md` — record grade + pattern decision
   - For Production+: define architecture fitness functions
   - For Enterprise+: define scale triggers and decay detection rules

5. **Confirm architecture with user before proceeding**
   - Show summary: grade, pattern, key NFRs, tech stack
   - Get explicit confirmation before moving to epics
   - Architecture becomes the guardrail for ALL subsequent sprints

### Phase 1: Project Context

1. **Load project context**
   - Read current project state and any existing roadmap
   - Load learned patterns from previous sprints (if any)
   - Load architecture principles (now populated from Phase 0)

2. **Analyze project scope**
   - If codebase exists, scan for existing modules, entry points, dependencies
   - Identify architectural boundaries and integration points
   - Note technical debt or existing patterns

### Phase 2: Epic Definition

3. **Define epics (informed by architecture)**
   - Break project into 3-8 epics based on functional domains from architecture
   - Each epic gets: id, title, description, modules[], dependencies[], priority
   - Estimate sprint count per epic
   - Order by dependency graph and priority
   - **For Production+ grades**: include infrastructure/observability epics (not just features)
   - **For Enterprise+ grades**: include security hardening and compliance epics

4. **Map module dependencies**
   - Build dependency graph between epics
   - Identify critical path
   - Flag circular dependencies as blockers
   - Validate against module boundaries from `brain/architecture.md`

### Phase 3: Sprint Candidates

5. **Propose sprint candidates**
   - Suggest first 2-3 sprints from highest-priority, lowest-dependency epics
   - Each candidate includes: goal, scope summary, estimated tasks
   - Align with architecture principles and NFR targets
   - **PoC/MVP**: first sprint should deliver end-to-end thin slice
   - **Production+**: first sprint should include CI/CD and basic observability setup
   - **Enterprise+**: first sprint should include auth/authz foundation

6. **Generate roadmap report**

## Governance Checks
- Verify epics align with architecture principles
- Check that no epic violates core policies
- Ensure dependency ordering respects architectural boundaries
- Validate module decomposition against coding rules
- **Architecture discovery must be completed before epics are defined**
- **NFRs must be populated before sprint candidates are proposed**

## State Updates
- `roadmap.json`: write full epic list, dependencies, current_phase
- `context-state.json`: update last_context_pack, loaded_rules

## Output
```
Roadmap Created/Updated
  Architecture: {grade} — {pattern}
  Epics: {n} defined
  Critical Path: {epic_ids}
  Sprint Candidates: {n} ready
  Dependencies: {n} mapped
  NFRs: {n} targets defined
  Fitness Functions: {n} (Production+ only)
  Estimated Total Sprints: {n}
  Next: /build-sprint to begin first sprint
```
