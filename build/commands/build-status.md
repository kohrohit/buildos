---
description: "Show project state: roadmap position, active sprint, tasks, blockers, patterns"
---

# /build-status — Project Status Dashboard

## Purpose
Display a comprehensive view of the current project state including roadmap position, active sprint progress, task status, blockers, latest review outcomes, and recently learned patterns. Read-only command — no state mutations.

## Context Pack
Load: minimal — only state files, no governance (read-only operation)

Load: `state/current-project.json`, `state/roadmap.json`, `state/sprint-state.json`, `state/task-state.json`, `state/context-state.json`, `state/learned-patterns.json`, `state/staging-patterns.json`

## Steps

1. **Load all state files**
   - Read all 6 state files
   - Handle missing or corrupted state gracefully
   - If not initialized, suggest running /build-init

2. **Project overview**
   - Project name, description, governance version
   - Initialization date, total sprints completed

3. **Roadmap position**
   - Total epics, completed, in-progress, pending
   - Current phase
   - Critical path status

4. **Active sprint**
   - Sprint ID, goal, status
   - Time since started
   - Scope summary (in/out)

5. **Task progress**
   - Tasks by status: pending, in-progress, completed, blocked
   - Current/next task details
   - Files modified count

6. **Blockers**
   - List any active blockers from sprint or tasks
   - Severity and age of each blocker

7. **Latest review**
   - Last review date and outcome
   - Key scores (code, security, architecture)

8. **Recent patterns**
   - Last 5 learned patterns
   - Highest confidence patterns

9. **Learning health**
   - Active pattern count by trust level (high, medium, low)
   - Staged patterns pending review
   - Patterns expiring within 14 days
   - Expired and archived pattern counts

## Governance Checks
- None (read-only command)

## State Updates
- None (read-only command)

## Output
```
BuildOS Status Dashboard
========================

Project: {name}
  Initialized: {date}  |  Governance: {version}
  Sprints Completed: {n}

Roadmap: {completed}/{total} epics
  Phase: {current_phase}
  [=====-----] {percent}%

Active Sprint: {sprint_id}
  Goal: {goal}
  Status: {status}  |  Started: {date}
  Tasks: {completed}/{total} ({blocked} blocked)

Current Task: {task_id} — {title}
  Type: {type}  |  Status: {status}

Blockers: {n} active
  {blocker_list}

Last Review: {date} — {outcome}
  Code: {n}/5  |  Security: {n}/5  |  Architecture: {n}/5

Recent Patterns: {n} learned
  - {pattern_1}
  - {pattern_2}

Learning Health
├─ Active patterns: {n} ({high} high, {med} medium, {low} low trust)
├─ Staged (pending review): {n}
├─ Expiring within 14 days: {n}
├─ Expired: {n}
└─ Archived: {n}

OpenSpace: {enabled|disabled}
  {if enabled:}
  ├─ Local skills: {n} ({healthy} healthy, {degraded} degraded)
  ├─ Cloud: {enabled|disabled}
  ├─ Tasks delegated this sprint: {n}
  └─ Tokens saved (est.): {n}
  {if disabled:}
  └─ Enable with: /build-openspace enable
```
