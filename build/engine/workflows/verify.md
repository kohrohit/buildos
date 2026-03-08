# Workflow: Verify

## Goal

Verify that sprint or task output meets all acceptance criteria, governance standards, and quality thresholds. This workflow acts as the quality gate between execution and release, producing a structured verification report that determines whether work is approved, needs revision, or is rejected.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Sprint specification | `state/sprints/{sprint-id}.md` | Yes |
| Sprint state | `state/sprint-state.json` | Yes |
| Task completion records | `state/sprint-state.json` | Yes |
| Acceptance criteria | `state/sprints/{sprint-id}.md` | Yes |
| Test plan | `state/sprints/{sprint-id}-tests.md` | Yes |
| Governance rules | `governance/rules/` | Yes |
| Architecture spec | `governance/brain/architecture.md` | Yes |
| NFR requirements | `governance/brain/nfrs.md` | Yes |
| Implemented code | Project source files | Yes |
| Test results | Test runner output | Yes |

## Steps

### Step 1: Load Verification Context

Assemble the context needed to perform a thorough verification.

- Load the sprint specification and its acceptance criteria.
- Load the sprint state to identify all completed tasks and their declared outputs.
- Load the test plan to understand expected coverage and test types.
- Load governance rules applicable to the code under review.
- Load the architecture specification for conformance checking.
- Load NFR thresholds for performance, security, and reliability checks.

### Step 2: Check Acceptance Criteria

Systematically verify each acceptance criterion defined in the sprint specification.

- For each criterion, determine the verification method (test, inspection, demonstration).
- Execute or review the verification method.
- Record the result as `pass`, `fail`, or `not-applicable` with justification.
- If a criterion fails, document:
  - What was expected.
  - What was observed.
  - The severity (blocker, major, minor).
  - Suggested remediation.
- A sprint cannot pass verification if any blocker-severity criterion fails.

### Step 3: Run Code Review Agent

Invoke the `code-reviewer` governance agent to perform structural code review.

- The code reviewer examines all files modified during the sprint.
- Review dimensions include:
  - Code clarity and readability.
  - Naming conventions and consistency.
  - Error handling completeness.
  - Duplication and DRY violations.
  - Complexity metrics (cyclomatic complexity, nesting depth).
  - Documentation completeness (public APIs, complex logic).
- Each finding is categorized as `blocker`, `major`, `minor`, or `suggestion`.
- Blockers must be resolved before verification can pass.

### Step 4: Run Security Review Agent

Invoke the `security-reviewer` governance agent for security-focused review.

- The security reviewer scans all modified and new files.
- Review dimensions include:
  - Input validation and sanitization.
  - Authentication and authorization correctness.
  - Secrets management (no hardcoded credentials, tokens, or keys).
  - SQL injection, XSS, and other injection vulnerabilities.
  - Dependency vulnerability scanning.
  - Secure defaults and fail-safe behavior.
  - Data exposure in logs, errors, or API responses.
- Security blockers are always sprint-blocking — no exceptions.

### Step 5: Check Test Coverage

Validate that testing meets the sprint's defined thresholds.

- Run the full test suite for all modified modules.
- Compute line and branch coverage for modified files.
- Compare coverage against the sprint's coverage target (default: 80%).
- Verify that all test types specified in the test plan were executed:
  - Unit tests for individual functions and methods.
  - Integration tests for cross-module interactions.
  - Edge case tests for boundary conditions.
  - Performance tests if NFRs require them.
- Flag untested code paths, especially in error handling and edge cases.

### Step 6: Check Architecture Conformance

Verify that the implementation respects architectural boundaries.

- Validate that no module imports from a module it should not depend on.
- Verify that public interfaces match their specifications.
- Confirm that new modules are registered in the architecture if required.
- Check that the dependency direction follows the architecture's layering rules.
- Verify that no architectural erosion has occurred (shortcuts that bypass layers).
- Compare the actual dependency graph against the planned dependency graph.

### Step 7: Produce Verification Report

Compile all findings into a structured verification report.

- Use `engine/templates/report-template.md` as the report structure.
- Summarize the overall verdict: `approved`, `approved-with-reservations`, or `rejected`.
- List all acceptance criteria results.
- Include code review findings organized by severity.
- Include security review findings organized by severity.
- Report test coverage metrics and any gaps.
- Report architecture conformance results.
- If rejected, provide a clear remediation plan with specific tasks.
- Write the report to `state/reports/{sprint-id}-verification.md`.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Verification report | `state/reports/{sprint-id}-verification.md` | Markdown |
| Updated sprint state | `state/sprint-state.json` | JSON |
| Code review findings | Embedded in verification report | Markdown |
| Security review findings | Embedded in verification report | Markdown |
| Coverage report | Embedded in verification report | Markdown |

## Checks

- Every acceptance criterion has a recorded result (no criterion left unchecked).
- Code review has been performed on all modified files.
- Security review has been performed on all modified files.
- Test coverage meets or exceeds the defined threshold.
- No blocker-severity findings remain unresolved.
- Architecture conformance check has passed.
- The verification report is complete and written to state.

## Failure Handling

| Failure | Response |
|---------|----------|
| Acceptance criterion fails (blocker) | Reject sprint; create remediation tasks; return to execute workflow. |
| Acceptance criterion fails (minor) | Approve with reservations; log for next sprint. |
| Code review blocker found | Reject sprint; specify the exact fix required. |
| Security vulnerability found | Reject sprint immediately; create security fix task with highest priority. |
| Test coverage below threshold | Reject sprint; create tasks for missing test coverage. |
| Architecture violation found | Reject sprint; specify the conformance fix required. |
| Test suite fails to run | Block verification; debug test infrastructure before re-attempting. |
| Review agent unavailable | Fall back to manual checklist review; document the limitation. |

## Governance Interaction

- **Uses Agents**: `code-reviewer`, `security-reviewer`, `qa-verifier` governance agents.
- **Reads**: All governance rules, architecture spec, NFRs.
- **Validates**: Implementation against the full governance standard.
- **Reports**: Findings are structured for governance traceability.
- **Escalates**: Security blockers are escalated immediately regardless of sprint status.

## Context Interaction

- **Context Pack**: `review` — loads sprint spec, modified files, test results, and governance rules.
- **Context Size**: Medium-to-large. Verification requires reading all modified code plus governance context.
- **Context Output**: Verification report consumed by the release workflow.
- **Context Cleanup**: Review context is released after the report is finalized.
