---
description: "Compress completed work into summaries, record patterns and ADRs"
---

# /build-learn — Knowledge Compression

## Purpose
After a sprint is verified and reviewed, compress the completed work into reusable summaries, update the learned-patterns registry, record architecture decision records (ADRs), and refresh the context state for future sprints.

## Context Pack
Load: `governance/core-policies.md`, `context/learning-context.md`

Also load: `state/sprint-state.json`, `state/task-state.json`, `state/learned-patterns.json`, `state/context-state.json`

## Steps

1. **Gather sprint artifacts**
   - Read all completed tasks and their outcomes
   - Collect files modified, decisions made, blockers encountered
   - Load verification and review results

2. **Extract patterns**
   - Identify recurring solutions or approaches used
   - Categorize: architecture, coding, testing, process, tooling
   - Assign confidence score based on outcome (verified + reviewed = high)
   - Check against existing patterns for reinforcement or conflict

3. **Compress sprint summary**
   - Write a concise sprint summary (what was built, key decisions, outcomes)
   - Include: goal achieved (yes/no), deviations from plan, lessons
   - This summary becomes context for future sprints

4. **Record ADRs**
   - For any significant architectural decisions made during sprint
   - Format: context, decision, consequences, status
   - Link to relevant governance principles

5. **Update pattern registry (with inline approval)**
   - For each extracted pattern, present to user:
     - Category, description, why, confidence
   - Ask user: **approve** / **reject** / **edit** for each
   - Only approved patterns are saved via `PatternManager.addPattern()` with `source: "sprint_review"`, `trust: "medium"`, `ttl_days: 90`
   - Rejected patterns are discarded
   - Edited patterns: apply user modifications, then save
   - Check for duplicates: if >80% semantic overlap with existing pattern, reinforce instead of creating new
   - Increment `times_applied` for reinforced patterns via `PatternManager.reinforcePattern()`

6. **OpenSpace skill extraction** (only if `openspace.enabled: true`)
   - Analyze completed sprint for reusable multi-task patterns
   - For each candidate, prompt user:
     ```
     OpenSpace: Capture sprint pattern as skill?
       Name: "{skill_name}"
       Description: {what it does}
       Based on: Tasks {task_ids}
       Confidence: {score}
       
       Capture? (y/n/edit)
     ```
   - Only save with explicit user approval
   - Skills stored locally in `openspace_skills/` — not uploaded to cloud
   - If OpenSpace disabled, skip this step entirely

7. **Refresh context state**
   - Update active_summaries with new sprint summary
   - Log compression in compression_log
   - Update freshness_check_at
   - Prune old summaries if context budget exceeded

7. **Mark sprint complete**

## Governance Checks
- Patterns must not contradict governance rules
- ADRs must reference relevant architecture principles
- Summaries must not contain secrets or sensitive data
- Context budget must be respected

## State Updates
- `learned-patterns.json`: add new patterns, update existing
- `context-state.json`: update summaries, compression_log, freshness
- `sprint-state.json`: set status to "completed", record completed_at
- `current-project.json`: increment total_sprints_completed, update last_learn
- `roadmap.json`: update epic progress

## Output
```
Learning Recorded
  Sprint: {sprint_id} — COMPLETED
  Patterns: {n} approved, {n} rejected, {n} reinforced
  ADRs Recorded: {n}
  Summary: compressed to {n} tokens
  Context Budget: {used}/{max}
  Sprints Completed: {total}
  OpenSpace: {n} skills captured, {n} skipped (or "disabled")
  Next: /build-sprint (next sprint) or /build-status (review state)
```
