# Workflow: Execute

## Goal

Execute the active sprint task by task, producing working code that meets acceptance criteria while obeying governance rules. This is the core implementation workflow where code is written, tested, and validated at the task level before advancing to the next task.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Sprint specification | `state/sprints/{sprint-id}.md` | Yes |
| Sprint state | `state/sprint-state.json` | Yes |
| Task specifications | `state/tasks/{task-id}.md` | Yes |
| Governance rules | `governance/rules/` | Yes |
| Architecture spec | `governance/brain/architecture.md` | Yes |
| Pre-commit hooks config | `governance/hooks/` | Yes |
| Specialist agent definitions | `governance/agents/` | No |
| Existing codebase | Project source | Yes |

## Steps

### Step 1: Load Sprint Context

Initialize the execution environment with minimal, targeted context.

- Read `state/sprint-state.json` to determine the active sprint and current progress.
- Load the sprint specification for the active sprint.
- Identify the current task queue and their dependency order.
- Do NOT load the full codebase into context. Only load files relevant to the current task.
- Verify the sprint status is `in-progress` or `ready`. If `ready`, transition to `in-progress`.

### Step 2: Pick Next Task

Select the next task to execute based on dependency order and status.

- Scan the task list for the first task with status `pending` whose dependencies are all `complete`.
- If no task is eligible (all blocked), report the blocker and pause execution.
- Load the task specification from `state/tasks/{task-id}.md`.
- Transition the task status to `in-progress` in `state/sprint-state.json`.
- Log the task start timestamp.

### Step 3: Load Execution Context Pack

Load the minimal context required to execute this specific task.

- Read the task specification for files to modify, acceptance criteria, and approach.
- Load only the source files listed in the task specification.
- Load relevant test files if they exist.
- Load the module's public interface definition if modifying a module boundary.
- Load any governance rules specific to the task type (e.g., security rules for auth work).
- Total context should be as small as possible — prefer surgical precision over broad awareness.

### Step 4: Apply Governance Rules

Before writing any code, internalize the applicable governance constraints.

- Load active governance rules from `governance/rules/`.
- Identify rules that apply to this task based on file paths, module, and task type.
- Load the relevant specialist agent guidance if the task domain matches:
  - `security-reviewer` for auth, crypto, or data handling tasks.
  - `code-reviewer` for all implementation tasks.
  - `performance-reviewer` for tasks with performance NFRs.
- Note all constraints that must be satisfied before the task can be marked complete.

### Step 5: Implement

Execute the actual code changes for the task.

- Follow the technical approach outlined in the task specification.
- Write code that satisfies all acceptance criteria.
- Write or update tests to cover the new or modified code.
- Follow coding standards defined in governance rules.
- Keep changes minimal and focused — do not refactor beyond the task scope.
- If the implementation reveals an unexpected complexity or blocker:
  - Document the issue in the task state.
  - If the blocker is solvable within the task scope, resolve it.
  - If the blocker requires scope change, pause and escalate.

### Step 6: Run Pre-Commit Hooks

Execute all configured pre-commit validation hooks before finalizing.

- Run linting hooks to verify code style and formatting.
- Run type-checking hooks if the project uses static types.
- Run unit tests for modified files.
- Run security scanning hooks for sensitive file patterns.
- Run architecture conformance hooks to verify module boundary integrity.
- If any hook fails:
  - Fix the issue if it is a straightforward correction.
  - Re-run the failed hook to confirm the fix.
  - If the fix requires significant changes, document and escalate.

### Step 7: Update Task State

Record the task outcome in the sprint state.

- Transition the task status to `complete` or `blocked` in `state/sprint-state.json`.
- Record the completion timestamp.
- Record the list of files created or modified.
- Record test results (pass count, fail count, coverage).
- Record any issues encountered and their resolutions.
- If the task produced artifacts beyond code (e.g., config files, migrations), note them.

### Step 8: Check Sprint Completion

Determine whether the sprint is complete or more tasks remain.

- If all tasks are `complete`, transition the sprint status to `verification-ready`.
- If tasks remain, return to Step 2 to pick the next task.
- If any tasks are `blocked` with no path forward, pause the sprint and report.
- Update `state/sprint-state.json` with the overall sprint progress.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Implemented code | Project source files | Code |
| Updated/new tests | Project test files | Code |
| Updated sprint state | `state/sprint-state.json` | JSON |
| Task completion records | `state/sprint-state.json` | JSON |
| Hook execution logs | `state/logs/hooks/` | Text |
| Blocker reports (if any) | `state/blockers/` | Markdown |

## Checks

- Every task's acceptance criteria are satisfied before marking complete.
- All pre-commit hooks pass for every completed task.
- No task modifies files outside its declared scope without documentation.
- Test coverage meets or exceeds the sprint's coverage target.
- No governance rule violations exist in the implemented code.
- The dependency order is respected — no task starts before its dependencies complete.
- Sprint state is consistent (no orphaned tasks, no status contradictions).

## Failure Handling

| Failure | Response |
|---------|----------|
| Task blocked by unmet dependency | Mark task as `blocked`; attempt next eligible task; report blocker. |
| Pre-commit hook failure | Fix the issue; re-run hook; if unfixable, mark task as `blocked`. |
| Test failure | Debug and fix; if the fix changes scope, document and flag for review. |
| Implementation reveals missing spec | Pause task; document the gap; request sprint workflow to amend spec. |
| Architecture violation detected | Revert the violating change; consult governance for guidance. |
| Context too large for task | Split task into subtasks with narrower file scope; update sprint state. |
| External dependency failure | Mark task as `blocked`; document the external dependency issue. |

## Governance Interaction

- **Reads**: All active governance rules, specialist agent definitions, hook configurations.
- **Obeys**: Every rule is treated as a hard constraint during implementation.
- **Runs**: Pre-commit hooks after every task implementation.
- **Consults**: Specialist agents for domain-specific tasks (security, performance).
- **Escalates**: Rule conflicts or scope changes to governance for resolution.

## Context Interaction

- **Context Pack**: `execution` — loads only task-relevant source files, tests, and rules.
- **Context Size**: Minimal. Each task loads only the files it needs to modify.
- **Context Rotation**: Context is cleared and reloaded between tasks to prevent drift.
- **Context Output**: Updated sprint state and task records for verification workflow.
- **Context Discipline**: Never load the full codebase; prefer targeted file loading.

---

## Parallel Execution Variant (Ralph Loop)

When `/build-execute --parallel` is used, the sequential workflow above is replaced by wave-based parallel execution. The key differences:

### What Changes

| Aspect | Sequential | Parallel |
|--------|-----------|----------|
| Task selection | Pick next pending by dependency order | DAGBuilder groups all tasks into waves |
| Execution | One task at a time, single context | Multiple tasks per wave, each in isolated worktree |
| Context | Reloaded per task from shared state | Per-unit execution pack + cumulative ledger |
| State updates | Executor writes to sprint-state.json directly | Orchestrator updates state after wave completion |
| Failure handling | Mark blocked, attempt next task | Evict failed unit, snapshot, recalculate DAG, continue |

### What Stays the Same

- Governance rules are loaded and obeyed identically
- Pre-commit hooks run in each worktree
- Task acceptance criteria must be met
- Coding standards enforced per governance rules
- Sprint completion triggers verification-ready transition

### Context Rotation

In sequential mode, context is cleared between tasks. In parallel mode:
- **Within a wave:** each agent has independent, isolated context (worktree)
- **Between waves:** orchestrator merges code and updates execution ledger
- **Ledger carries forward:** decisions, interfaces, and warnings from prior waves are included in the next wave's context pack

See `/build-execute` command definition for the full parallel mode protocol.
