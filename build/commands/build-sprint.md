---
description: "Define a new sprint with goal, scope, deliverables, and acceptance criteria"
---

# /build-sprint — Sprint Definition

## Purpose
Pick an epic (or continue one), define a sprint goal with clear scope, deliverables, acceptance criteria, and task breakdown. Updates sprint-state.json to drive execution.

## Context Pack
Load: `governance/core-policies.md`, `governance/coding-rules.md`, `context/execution-context.md`

Also load: `state/roadmap.json`, `state/sprint-state.json`, `state/learned-patterns.json`

## Steps

1. **Check sprint readiness**
   - Verify no active sprint is in-progress (if so, ask to complete or cancel)
   - Load roadmap to identify next epic/sprint candidate
   - Review learned patterns for relevant insights

2. **Select epic and define goal**
   - Present sprint candidates from roadmap
   - User selects or refines the target epic
   - Define a single, clear sprint goal (one sentence)

3. **Define scope boundaries**
   - List in_scope items: specific modules, features, files
   - List out_of_scope items: what this sprint explicitly does NOT touch
   - Scope must be achievable in one focused session

4. **Define deliverables and acceptance criteria**
   - Each deliverable: a concrete artifact (file, module, endpoint, test)
   - Each acceptance criterion: a verifiable statement
   - Criteria must be testable by /build-verify

5. **Break into tasks**
   - 3-8 tasks per sprint
   - Each task: id, title, type (implement|refactor|test|docs|config), estimated_files
   - Order tasks by dependency
   - Write tasks to task-state.json

6. **Activate sprint**
   - Set sprint status to "active"
   - Record started_at timestamp

## Governance Checks
- Sprint scope must align with epic boundaries from roadmap
- Deliverables must conform to architecture principles
- Task types must respect coding rules
- Acceptance criteria must include governance compliance

## State Updates
- `sprint-state.json`: full sprint definition with all fields
- `task-state.json`: all sprint tasks with "pending" status
- `current-project.json`: update active_sprint
- `roadmap.json`: update epic status to "in-progress"

## Output
```
Sprint Activated
  Sprint: {sprint_id}
  Epic: {epic_title}
  Goal: {goal}
  Tasks: {n} defined
  Deliverables: {n} expected
  Acceptance Criteria: {n} defined
  Next: /build-execute to begin work
```
