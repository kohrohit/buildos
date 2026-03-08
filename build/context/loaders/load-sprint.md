# Loader: Sprint Context

## Purpose

Assembles the active sprint context for task execution, progress tracking, and
sprint-level decision-making. Provides the agent with awareness of what needs to
be done, what is in progress, and what constraints apply to current work.

## When to Use

- During `/build:sprint` phase (sprint planning and kickoff)
- During `/build:execute` phase (task implementation)
- When checking task dependencies or blockers
- When updating sprint state or task status

## Load Order

Files are loaded in this exact sequence:

1. `state/current-sprint.md` — Sprint spec: goals, scope, acceptance criteria
2. `state/tasks.md` — Full task list with statuses and assignments
3. `state/sprint-state.md` — Current progress, blockers, decisions made mid-sprint
4. Module context for active tasks (via `load-module.md`, scoped to relevant modules)
5. Applicable rules (via `load-rules.md`, scoped to languages touched this sprint)

## Inclusion Rules

| Source | Condition | Priority |
|---|---|---|
| `state/current-sprint.md` | Always | Critical |
| `state/tasks.md` | Always | Critical |
| `state/sprint-state.md` | Always | High |
| Module context | Only modules with pending/in-progress tasks | Medium |
| Language rules | Only languages used in sprint tasks | Medium |
| Relevant ADRs | Only ADRs referenced by sprint tasks | Low |

## Exclusion Rules

- Completed sprint specs from `state/archive/` — use summaries instead
- Tasks marked `done` with no open subtasks — exclude from active view
- Modules with no tasks in the current sprint
- Historical sprint state snapshots
- Unrelated ADRs not referenced by any current task

## Token Budget

- Target: ~2000 tokens
- Hard ceiling: 2800 tokens
- If budget exceeded: summarize completed tasks to one line each, drop module
  context for lowest-priority tasks, keep sprint spec and active tasks intact

## Freshness Rules

- Sprint state is the most volatile context — always reload before execution
- Task statuses may change between agent invocations — never cache
- Sprint spec is stable within a sprint — cache until sprint boundary
- If sprint state conflicts with task list, sprint state is authoritative
- Module context loaded here follows `load-module.md` freshness rules

## Assembly Notes

- Filter tasks.md to show only: pending, in-progress, blocked statuses
- For each active task, resolve its module and queue module context loading
- Collapse completed tasks into a count: "X of Y tasks complete"
- Include blocker details inline with blocked tasks
