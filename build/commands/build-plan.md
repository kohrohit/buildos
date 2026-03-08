---
description: "Create or update project roadmap with epics, modules, and dependencies"
---

# /build-plan — Roadmap Planning

## Purpose
Read the governance brain and project context, then create or refine a roadmap with epics, modules, dependencies, and sprint candidates. Produces a structured plan that drives all subsequent sprints.

## Context Pack
Load: `governance/core-policies.md`, `governance/architecture-principles.md`, `context/planning-context.md`

Also load: `state/current-project.json`, `state/roadmap.json`, `state/learned-patterns.json`

## Steps

1. **Load project context**
   - Read current project state and any existing roadmap
   - Load learned patterns from previous sprints (if any)
   - Load architecture principles for structural guidance

2. **Analyze project scope**
   - If codebase exists, scan for existing modules, entry points, dependencies
   - Identify architectural boundaries and integration points
   - Note technical debt or existing patterns

3. **Define epics**
   - Break project into 3-8 epics based on functional domains
   - Each epic gets: id, title, description, modules[], dependencies[], priority
   - Estimate sprint count per epic
   - Order by dependency graph and priority

4. **Map module dependencies**
   - Build dependency graph between epics
   - Identify critical path
   - Flag circular dependencies as blockers

5. **Propose sprint candidates**
   - Suggest first 2-3 sprints from highest-priority, lowest-dependency epics
   - Each candidate includes: goal, scope summary, estimated tasks
   - Align with architecture principles

6. **Generate roadmap report**

## Governance Checks
- Verify epics align with architecture principles
- Check that no epic violates core policies
- Ensure dependency ordering respects architectural boundaries
- Validate module decomposition against coding rules

## State Updates
- `roadmap.json`: write full epic list, dependencies, current_phase
- `context-state.json`: update last_context_pack, loaded_rules

## Output
```
Roadmap Created/Updated
  Epics: {n} defined
  Critical Path: {epic_ids}
  Sprint Candidates: {n} ready
  Dependencies: {n} mapped
  Estimated Total Sprints: {n}
  Next: /build-sprint to begin first sprint
```
