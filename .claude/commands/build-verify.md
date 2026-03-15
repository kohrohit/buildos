---
description: "Verify sprint output against acceptance criteria, coding rules, and architecture"
---

# /build-verify — Sprint Verification

## Purpose
Verify that sprint or task output meets acceptance criteria, conforms to coding rules, and aligns with architecture principles. Produces a verification outcome that gates sprint completion.

**CRITICAL: All review agents MUST be spawned with `isolation: "worktree"` to ensure unbiased, independent evaluation. Use `blind-review-pack.md` — never the standard `review-pack.md`.**

## Context Pack
Load for orchestrator only: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`

**Do NOT pass execution context, sprint-state decisions, or conversation history to review agents.**

## Steps

1. **Prepare blind review context**
   - Read sprint spec and extract ONLY: acceptance criteria, user stories, API contracts, data models
   - Strip all implementation reasoning, mid-sprint decisions, and blocker notes
   - Gather list of all files modified during sprint (filenames only, no commit messages)
   - Run test suite and capture raw output
   - Assemble context per `context/templates/blind-review-pack.md`

2. **Spawn isolated code review agent**
   - Use `Agent` tool with `isolation: "worktree"` and `subagent_type: "superpowers:code-reviewer"`
   - Pass ONLY: blind review context (spec + acceptance criteria + governance rules + file list)
   - Agent reads code fresh from filesystem — no diffs, no commit messages
   - Agent prompt MUST include the Independence Mandate from the agent definition
   - Collect findings with severity (must-fix, should-fix, nit)

3. **Spawn isolated security review agent**
   - Use `Agent` tool with `isolation: "worktree"` and `subagent_type: "superpowers:code-reviewer"`
   - Pass ONLY: blind review context + security baseline
   - Agent scans for vulnerabilities without knowing what the author intended
   - Collect findings with severity (Critical, High, Medium, Low)

4. **Spawn isolated architecture review agent**
   - Use `Agent` tool with `isolation: "worktree"`
   - Pass ONLY: blind review context + architecture spec + ADRs
   - Agent checks conformance without knowing why structural choices were made
   - Collect findings on boundary violations, coupling, dependency direction

5. **Check acceptance criteria (orchestrator)**
   - For each criterion, verify it is met using test results and code inspection
   - Mark each as: passed, failed, or partially-met
   - Record evidence for each judgment

6. **Run automated checks (orchestrator)**
   - If test suite exists, run it
   - If linter is configured, run it
   - If type checker is available, run it
   - Collect pass/fail results

7. **Aggregate and produce verification outcome**
   - Merge findings from all isolated agents
   - Cross-reference agent findings — if multiple agents flag the same area, escalate severity
   - Overall: PASS, PASS_WITH_WARNINGS, or FAIL
   - If FAIL: list required fixes before sprint can complete
   - If PASS_WITH_WARNINGS: list recommended improvements

## Agent Spawning Rules

| Rule | Rationale |
|---|---|
| Always use `isolation: "worktree"` | Prevents context contamination from execution session |
| Never pass `sprint-state.json` decisions | Contains implementation reasoning that causes bias |
| Never pass git commit messages | They reveal intent and justify shortcuts |
| Never pass task-level notes | They explain *why*, reviewer should judge *what* |
| Spawn agents in parallel when possible | Independent agents don't need sequential execution |
| Each agent gets the Independence Mandate | Explicit instruction to find flaws, not confirm quality |

## Governance Checks
- All acceptance criteria must be evaluated
- Coding rules violations above threshold cause FAIL
- Architecture violations always cause FAIL
- Security-related issues always cause FAIL

## State Updates
- `task-state.json`: update verification_status on each task
- `sprint-state.json`: record verification outcome
- `current-project.json`: update last_review timestamp

## Output
```
Verification Complete
  Sprint: {sprint_id}
  Outcome: {PASS|PASS_WITH_WARNINGS|FAIL}

  Independent Reviews:
    Code Review:     {verdict} — {n} must-fix, {n} should-fix, {n} nit
    Security Review: {verdict} — {n} critical, {n} high, {n} medium
    Architecture:    {verdict} — {n} violations found

  Acceptance Criteria: {passed}/{total}
  Automated Checks: {passed}/{total}
  Required Fixes: {list or "none"}
  Next: /build-review (deep review) or /build-learn (record patterns)
```
