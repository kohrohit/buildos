---
description: "Verify sprint output against acceptance criteria, coding rules, and architecture"
---

# /build-verify — Sprint Verification

## Purpose
Verify that sprint or task output meets acceptance criteria, conforms to coding rules, and aligns with architecture principles. Produces a verification outcome that gates sprint completion.

## Context Pack
Load: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`

Also load: `state/sprint-state.json`, `state/task-state.json`

## Steps

1. **Load verification targets**
   - Read sprint acceptance criteria
   - Read all completed task records
   - Gather list of all files modified during sprint

2. **Check acceptance criteria**
   - For each criterion, verify it is met
   - Mark each as: passed, failed, or partially-met
   - Record evidence for each judgment

3. **Check coding rules compliance**
   - Scan modified files against coding-rules.md
   - Check naming conventions, file structure, patterns
   - Check error handling, logging, type safety
   - Flag any violations with file and line reference

4. **Check architecture conformance**
   - Verify module boundaries are respected
   - Check dependency directions (no circular, no wrong-layer imports)
   - Validate interface contracts between modules
   - Ensure separation of concerns

5. **Run automated checks**
   - If test suite exists, run it
   - If linter is configured, run it
   - If type checker is available, run it
   - Collect pass/fail results

6. **Produce verification outcome**
   - Overall: PASS, PASS_WITH_WARNINGS, or FAIL
   - If FAIL: list required fixes before sprint can complete
   - If PASS_WITH_WARNINGS: list recommended improvements

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
  Acceptance Criteria: {passed}/{total}
  Coding Rules: {violations} violations
  Architecture: {conformant|violations_found}
  Automated Checks: {passed}/{total}
  Required Fixes: {list or "none"}
  Next: /build-review (deep review) or /build-learn (record patterns)
```
