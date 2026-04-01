# Workflow: Verify

## Goal

Verify that sprint or task output meets all acceptance criteria, governance standards, and quality thresholds using **independently isolated review agents**. This workflow acts as the quality gate between execution and release, producing a structured verification report that determines whether work is approved, needs revision, or is rejected.

**All review agents are spawned with `isolation: "worktree"` and receive only the blind review context pack to eliminate self-review bias.**

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Sprint specification | `state/sprints/{sprint-id}.md` | Yes |
| Sprint state | `state/sprint-state.json` | Yes (orchestrator only) |
| Task completion records | `state/sprint-state.json` | Yes (orchestrator only) |
| Acceptance criteria | `state/sprints/{sprint-id}.md` | Yes |
| Test plan | `state/sprints/{sprint-id}-tests.md` | Yes |
| Governance rules | `governance/rules/` | Yes |
| Architecture spec | `governance/brain/architecture.md` | Yes |
| NFR requirements | `governance/brain/nfrs.md` | Yes |
| Implemented code | Project source files | Yes |
| Test results | Test runner output | Yes |

## Bias Prevention Protocol

Before any review agent is spawned, the orchestrator MUST:

1. Prepare the blind review context per `context/templates/blind-review-pack.md`
2. Strip implementation reasoning, decisions, and blocker notes from sprint spec
3. Exclude git commit messages (they reveal intent)
4. Exclude task-level notes (they explain *why*)
5. Exclude previous review findings (prevents anchoring)
6. Include the Independence Mandate in every agent prompt

## Steps

### Step 1: Prepare Blind Review Context

Assemble a stripped-down context that gives reviewers ONLY objective facts.

- Load the sprint specification and extract acceptance criteria, user stories, API contracts, data models.
- **Strip**: technical approach narrative, design decisions, mid-sprint scope changes, blocker notes, compromise rationale.
- Load governance rules applicable to the code under review.
- Load the architecture specification for conformance checking.
- Load NFR thresholds for performance, security, and reliability checks.
- Identify modified files via `git diff --name-only` (filenames only).
- Run the full test suite and capture raw pass/fail output.
- Assemble per `context/templates/blind-review-pack.md`.

### Step 2: Spawn Isolated Review Agents (in parallel)

Spawn all review agents simultaneously. Each runs in its own worktree with no shared context.

#### Code Reviewer Agent
- Spawn: `Agent(isolation: "worktree")`
- Preamble: *"You are reviewing code you have never seen before. You have no knowledge of how or why it was written. Judge the code solely on what it does, how it does it, and whether it meets the specification. Your job is to find what is wrong, not to confirm what is right."*
- Input: blind review context + coding rules
- Agent reads all modified files fresh from filesystem
- Review dimensions: clarity, naming, SOLID, DRY, complexity, error handling, documentation, test coverage
- Output: findings categorized as `blocker`, `major`, `minor`, `suggestion`

#### Security Reviewer Agent
- Spawn: `Agent(isolation: "worktree")`
- Preamble: *"You are auditing code you have never seen before. Assume every input is hostile. Your job is to find vulnerabilities, not to confirm the code is secure."*
- Input: blind review context + security baseline + dependency manifests
- Agent reads all modified files fresh from filesystem
- Review dimensions: OWASP Top 10, secrets, input validation, auth/authz, injection, PII, dependencies
- Output: findings categorized as `Critical`, `High`, `Medium`, `Low`
- Security blockers are always sprint-blocking — no exceptions.

#### Architect Agent
- Spawn: `Agent(isolation: "worktree")`
- Preamble: *"You are reviewing architecture you have never seen before. Judge solely on whether the implementation conforms to the declared architecture. Your job is to find violations, not to justify design choices."*
- Input: blind review context + architecture spec + ADRs + NFRs
- Agent reads code structure fresh from filesystem
- Review dimensions: module boundaries, dependency direction, coupling, API contracts, layering
- Output: conformance report with violations

#### QA Verifier Agent
- Spawn: `Agent(isolation: "worktree")`
- Preamble: *"You are evaluating test quality for code you have never seen before. Judge solely on whether the tests adequately verify the specification. Your job is to find gaps, not to explain why gaps exist."*
- Input: blind review context + test results + coverage targets
- Agent reads test files fresh from filesystem
- Review dimensions: acceptance criteria coverage, assertion quality, edge cases, pyramid balance
- Output: coverage gap analysis with risk assessment

### Step 2.5: Spawn E2E Tester Agent (Isolated, Context-Free)

If the application has a UI or web interface, spawn the E2E tester in parallel with the review agents.

- Spawn: `Agent(isolation: "worktree")`
- Preamble: *"You are testing an application you have never seen before. You do not know how it was built, what framework it uses, or how the code is structured. You know only what the application should do (acceptance criteria) and where it runs (base URL). Your job is to verify every acceptance criterion through the browser using Playwright."*
- Input: stripped acceptance criteria + known routes + base URL + auth credentials
- **Does NOT receive**: source code, architecture docs, implementation details, git history
- Agent scaffolds Playwright project, generates tests from criteria, runs via `npx playwright test`
- Output: pass/fail per acceptance criterion, screenshots on failure, HTML report
- See `commands/build-e2e.md` for full workflow and `governance/agents/e2e-tester.md` for agent spec

**Note**: If the app is not running or not a web application, skip this step and log the reason.

### Step 3: Check Acceptance Criteria

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

### Step 4: Check Test Coverage

Validate that testing meets the sprint's defined thresholds.

- Run the full test suite for all modified modules.
- Compute line and branch coverage for modified files.
- Compare coverage against the sprint's coverage target (default: 80%).
- Verify that all test types specified in the test plan were executed.
- Flag untested code paths, especially in error handling and edge cases.

### Step 5: Aggregate and Produce Verification Report

Compile all findings from isolated agents into a structured verification report.

- Collect results from all isolated agents (4 review agents + E2E tester if applicable).
- **Cross-reference**: if 2+ agents flag the same area, auto-escalate severity.
- **Note disagreements**: areas where agents disagree highlight spots needing human judgment.
- Use `engine/templates/report-template.md` as the report structure.
- Summarize the overall verdict: `approved`, `approved-with-reservations`, or `rejected`.
- List all acceptance criteria results.
- Include all agent findings organized by severity.
- Report test coverage metrics and any gaps.
- Report architecture conformance results.
- If rejected, provide a clear remediation plan with specific tasks.
- Write the report to `state/reports/{sprint-id}-verification.md`.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Verification report | `state/reports/{sprint-id}-verification.md` | Markdown |
| E2E test report | `state/reports/{sprint-id}-e2e.md` | Markdown |
| E2E HTML report | `e2e/reports/html/index.html` | HTML |
| E2E screenshots | `e2e/reports/results/*.png` | PNG |
| Updated sprint state | `state/sprint-state.json` | JSON |
| Code review findings | Embedded in verification report | Markdown |
| Security review findings | Embedded in verification report | Markdown |
| Architecture findings | Embedded in verification report | Markdown |
| QA findings | Embedded in verification report | Markdown |
| Coverage report | Embedded in verification report | Markdown |

## Checks

- Every acceptance criterion has a recorded result (no criterion left unchecked).
- All 4 review agents were spawned with `isolation: "worktree"` (verify in report).
- All agents received blind review context only (no execution context leaked).
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
| E2E smoke tests fail | Block E2E journey tests; app must be functional before testing criteria. |
| E2E acceptance criterion fails | Must-fix; the spec is the contract. |
| E2E flaky test detected | Should-fix; quarantine and log for resolution within 2 sprints. |
| App not running for E2E | Skip E2E with warning; log in report. Do not block verification. |
| Review agent fails to spawn | Retry with isolation; if persistent, fall back to manual checklist with bias warning. |
| Cross-agent escalation (2+ agents flag same area) | Auto-classify as blocker regardless of individual severity. |

## Governance Interaction

- **Uses Agents**: `code-reviewer`, `security-reviewer`, `architect`, `qa-verifier`, `e2e-tester` — all spawned with `isolation: "worktree"`.
- **Reads**: All governance rules, architecture spec, NFRs.
- **Validates**: Implementation against the full governance standard.
- **Reports**: Findings are structured for governance traceability.
- **Escalates**: Security blockers are escalated immediately regardless of sprint status.
- **Bias Prevention**: All agents use blind review context pack; no execution context is shared.

## Context Interaction

- **Context Pack**: `blind-review` — loads stripped spec, governance rules, file list, test results. Does NOT load execution reasoning.
- **Context Size**: Medium. Blind review pack is smaller than full review pack (~4500 vs ~7500 tokens) because implementation reasoning is excluded.
- **Context Output**: Verification report consumed by the release workflow.
- **Context Cleanup**: Review context is released after the report is finalized.
