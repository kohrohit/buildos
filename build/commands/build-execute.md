---
description: "Execute the active sprint task, obey governance, produce execution report"
---

# /build-execute — Task Execution

## Purpose
Execute the next pending task in the active sprint. Uses the execution context pack, follows governance rules strictly, produces working code, and generates an execution report with state updates.

## Context Pack
Load: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`, `context/execution-context.md`

Also load: `state/sprint-state.json`, `state/task-state.json`, `state/context-state.json`

## Steps

1. **Load execution context**
   - Read active sprint and identify next pending task
   - If no pending tasks, report sprint execution complete
   - Load all governance rules into working context
   - Load relevant learned patterns

2. **Pre-execution checks**
   - Verify task is in-scope for active sprint
   - Check no blockers exist on this task
   - Confirm required dependencies (other tasks) are completed
   - Load relevant existing code for context

3. **Execute task**
   - Follow coding rules strictly (naming, structure, patterns)
   - Respect architecture principles (boundaries, interfaces)
   - Write clean, tested, documented code
   - Keep changes within declared scope
   - Use appropriate tools (Edit for existing files, Write for new files)

4. **Record modifications**
   - Track all files created or modified
   - Note any deviations from plan (and justify)
   - Flag any discovered blockers for subsequent tasks

5. **Self-validate**
   - Run available linters/formatters if configured
   - Check that output matches task deliverable expectations
   - Verify no governance violations in produced code

6. **Generate execution report**

## Governance Checks
- Every file edit must be within sprint scope
- Code must follow coding-rules.md patterns
- Architecture boundaries must not be violated
- No secrets, credentials, or sensitive data in code
- Error handling must follow project conventions

## State Updates
- `task-state.json`: update task status to "completed", record files_modified, completed_at
- `sprint-state.json`: update sprint progress
- `context-state.json`: update active_summaries

## Output
```
Task Executed
  Task: {task_id} — {title}
  Status: completed
  Files Modified: {n}
  Files Created: {n}
  Governance: {pass|warnings}
  Blockers Found: {n}
  Sprint Progress: {completed}/{total} tasks
  Next: /build-execute (more tasks) or /build-verify (validate sprint)
```

---

## Parallel Mode (`--parallel`)

When the `--parallel` flag is present, switch to wave-based parallel execution (Ralph Loop).

### Pre-Flight

1. Call `build-tools.cjs dag build` → returns wave plan as JSON
2. If result contains `error`, print error and abort
3. If `parallelizable` is `false`, print warning and fall back to sequential execution
4. Call `build-tools.cjs dag tier` → returns tier classification per task
5. Present wave plan with cost estimate to user, ask for confirmation:
   ```
   Wave Plan:
     Wave N: T-id (Tier X, Model), ...

     Opus units: N of M
     Proceed? (y/n)
   ```
6. If declined, abort and suggest sequential `/build-execute`
7. Call `build-tools.cjs ledger init` → creates execution-ledger.json

### Wave Loop

For each wave (starting from wave 1, or from next incomplete wave on resume):

**Step A — Read context:**
Call `build-tools.cjs ledger read` to get cumulative ledger from prior waves.

**Step B — Dispatch units:**
For each unit in the wave (up to `--max-agents N`, default 4):
- Assemble the agent prompt using the template below
- Dispatch via `Agent` tool with `isolation: "worktree"`
- All units in the wave (or sub-batch) dispatched in a single message (parallel)

**Step C — Collect results:**
After all agents complete, read `unit-report.json` from each worktree path.
If a unit-report.json is missing, treat the unit as failed with reason "agent did not produce unit-report.json".

**Step D — Validate merge:**
Collect all unit reports into a JSON array file.
Call `build-tools.cjs merge validate <wave> <reports.json>`
- If PASS: proceed to merge
- If FAIL: hard fail the wave, no merges applied, report DAG fix needed

**Step E — Handle failures:**
For any unit with status "failed" or "blocked":
1. Call `build-tools.cjs ledger` to record the failure
2. Identify downstream tasks that depend on the failed unit
3. Mark downstream tasks as `blocked_by_failure` in task-state.json
4. Preserve the failed unit's worktree branch

**Step F — Merge:**
For each passing unit (in task-ID order):
1. Merge the worktree branch into the sprint branch
2. Record decisions and interfaces from unit-report.json into ledger

**Step G — Update ledger:**
Call `build-tools.cjs ledger update <wave-number>` with wave results.

**Step H — Next wave:**
If more waves remain (with pending tasks), repeat from Step A.
If all waves complete or only blocked tasks remain, proceed to final report.

### Final Report

Call `build-tools.cjs ledger finalize` and display:

```
Ralph Loop Execution Complete
  Sprint: {sprint_id}
  Waves completed: N
  Units passed: N
  Units failed: N
  Units blocked: N

  Options:
  → /build-execute --parallel    Resume remaining waves
  → /build-execute               Switch to sequential
  → Fix failed units manually    Worktrees preserved
  Next: /build-verify (if all tasks complete)
```

### Agent Prompt Template

```
You are executing unit {unit_id} of sprint {sprint_id}, wave {wave_number}.

## Your Task
{task object extracted from state/task-state.json for this unit_id}

## Governance Rules
{standard execution pack governance — identical for all units}

## Context from Prior Waves
{cumulative ledger — decisions, interfaces, warnings}

## Tier: {1|2|3}
{tier-specific instructions — Tier 3 includes security-reviewer or relevant specialist guidance}

## Critical Constraints (Parallel Mode)
- You MUST NOT write to sprint-state.json or task-state.json
- You MUST NOT modify files outside your task's declared file_scope
- You MUST write unit-report.json before your session ends

## Output Requirements
After completing your work:
1. Commit all changes on your worktree branch
2. Write unit-report.json to the worktree root ({worktree-path}/unit-report.json):
{
  "unit_id": "{unit_id}",
  "status": "completed|failed|blocked",
  "files_modified": [],
  "files_created": [],
  "decisions": [{"description": "...", "files_affected": [...]}],
  "interfaces_defined": [{"name": "...", "file": "...", "exports": [...]}],
  "warnings": [],
  "failure_reason": null
}
```
