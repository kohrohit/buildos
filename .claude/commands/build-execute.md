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
