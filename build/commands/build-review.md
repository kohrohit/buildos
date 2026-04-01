---
description: "Deep governance review with independent, isolated code, security, and architecture review agents"
---

# /build-review — Deep Governance Review (Isolated)

## Purpose
Perform a thorough multi-perspective review using **fully isolated agents** that have zero knowledge of the execution session. Each reviewer sees only the specification and the code — never the reasoning, decisions, or trade-offs made during implementation. This eliminates self-review bias.

**CRITICAL: Every review agent MUST be spawned with `isolation: "worktree"`. No exceptions. Use `blind-review-pack.md` exclusively.**

## Context Pack
Orchestrator loads: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`, `state/sprint-state.json`, `state/task-state.json`

**Agents receive ONLY the blind review pack — never the orchestrator's full context.**

## Steps

1. **Prepare blind review context**
   - Read sprint spec from `state/sprints/{sprint-id}.md`
   - Extract ONLY: user stories, acceptance criteria, API contracts, data models, test case definitions
   - **Strip**: technical approach narrative, design decisions, mid-sprint scope changes, blocker notes, compromise rationale
   - Identify all modified files from `git diff --name-only` (no commit messages)
   - Run full test suite and capture raw pass/fail output
   - Load governance rules, architecture spec, NFRs, relevant ADRs
   - Assemble per `context/templates/blind-review-pack.md`

2. **Spawn Code Reviewer Agent** (isolated)
   - `Agent(isolation: "worktree")`
   - Prompt preamble: *"You are reviewing code you have never seen before. You have no knowledge of how or why it was written. Judge the code solely on what it does, how it does it, and whether it meets the specification. Your job is to find what is wrong, not to confirm what is right."*
   - Pass: stripped spec + acceptance criteria + coding rules + modified file list
   - Agent reads code fresh from filesystem
   - **SOLID compliance is scored first — any violation is must-fix and blocks merge**
   - Review dimensions: **SOLID (SRP, OCP, LSP, ISP, DIP)**, readability, DRY, naming, complexity, error handling, test coverage, documentation
   - SOLID score: 1-5 (score <4 = automatic CHANGES_REQUESTED)
   - Score: 1-5 on each other dimension
   - Findings: must-fix (all SOLID violations), should-fix, nit

### Automated Security Scan

Before dispatching the security-reviewer agent:

1. Run `build-tools.cjs scan project` — full SAST + dependency audit
2. Read scan results from `build-tools.cjs scan report`
3. Include findings in the security-reviewer agent's context pack:

```
## Scan Findings
The following vulnerabilities were detected by automated scanning tools:

{findings from scan report, formatted as table}

Cross-reference these findings with your manual code review. Flag any that the
scanners missed. Assess whether scanner findings are true positives or false positives.
```

The security-reviewer now has structured scan data alongside the code. It should:
- Confirm or dispute each automated finding
- Identify vulnerabilities the scanners missed
- Recommend specific fixes for confirmed findings

3. **Spawn Security Reviewer Agent** (isolated)
   - `Agent(isolation: "worktree")`
   - Prompt preamble: *"You are auditing code you have never seen before. Assume every input is hostile. You do not know what the author intended — only what the code does. Your job is to find vulnerabilities, not to confirm the code is secure."*
   - Pass: stripped spec + security baseline + modified file list + dependency manifests
   - Agent reads code and configs fresh from filesystem
   - Review dimensions: OWASP Top 10, secrets, input validation, auth/authz, PII, dependencies, crypto
   - Score: 1-5 on each dimension
   - Findings: Critical, High, Medium, Low

4. **Spawn Architect Agent** (isolated)
   - `Agent(isolation: "worktree")`
   - Prompt preamble: *"You are reviewing architecture you have never seen before. You do not know why structural decisions were made. Judge solely on whether the implementation conforms to the declared architecture. Your job is to find violations, not to justify design choices."*
   - Pass: stripped spec + architecture spec + ADRs + NFRs + modified file list
   - Agent reads code and structure fresh from filesystem
   - Review dimensions: module boundaries, coupling, dependency direction, API contracts, scalability, ADR conformance
   - Score: 1-5 on each dimension
   - Findings: boundary violations, coupling risks, contract mismatches

5. **Spawn QA Verifier Agent** (isolated)
   - `Agent(isolation: "worktree")`
   - Prompt preamble: *"You are evaluating test quality for code you have never seen before. You do not know what testing constraints the team faced. Judge solely on whether the tests adequately verify the specification. Your job is to find gaps, not to explain why gaps exist."*
   - Pass: stripped spec + acceptance criteria + test results + coverage targets
   - Agent reads test files fresh from filesystem
   - Review dimensions: acceptance criteria coverage, test quality, edge cases, pyramid balance, flaky tests
   - Findings: untested criteria, weak assertions, missing edge cases

6. **Spawn E2E Tester Agent** (isolated, context-free — if web app)
   - `Agent(isolation: "worktree")`
   - Prompt preamble: *"You are testing an application you have never seen before. You do not know how it was built, what framework it uses, or how the code is structured. You know only what the application should do (acceptance criteria) and where it runs (base URL). Verify every acceptance criterion through the browser using Playwright."*
   - Pass: stripped acceptance criteria + known routes/pages + base URL + auth test credentials
   - **Agent does NOT receive**: source code, architecture docs, git history, implementation details
   - Agent generates Playwright tests from criteria, runs via `npx playwright test --headless`
   - Output: pass/fail per acceptance criterion, screenshots on failure, HTML report
   - If app is not running or not a web app, skip and log reason

7. **NFR Assessment** (orchestrator)
   - Performance: any obvious bottlenecks or anti-patterns
   - Reliability: error recovery, graceful degradation
   - Observability: logging, metrics, tracing readiness
   - Maintainability: complexity assessment

7. **Synthesize review**
   - Aggregate scores and findings from all isolated agents
   - Cross-reference: if 2+ agents flag the same area, auto-escalate severity
   - Identify critical issues (must-fix)
   - Identify improvements (should-fix)
   - Identify suggestions (nice-to-have)
   - Note any disagreements between agents (these highlight areas needing human judgment)

## Agent Spawning Rules

| Rule | Rationale |
|---|---|
| Always `isolation: "worktree"` | Prevents context contamination from execution session |
| Always include Independence Mandate preamble | Forces adversarial mindset — find flaws, not confirm quality |
| Never pass `sprint-state.json` to agents | Contains implementation reasoning that causes confirmation bias |
| Never pass git commit messages | They reveal intent and justify shortcuts |
| Never pass task-level notes or blocker history | They explain *why* — reviewer should judge *what* |
| Never pass previous review findings | Prevents anchoring to prior assessments |
| Spawn all 4 agents in parallel | They are independent — no sequential dependency |
| Each agent reads code from filesystem | Fresh read, no pre-digested summaries |

## Governance Checks
- **SOLID violations block approval (must-fix severity, no exceptions)**
- **SOLID score <4 from code reviewer = automatic CHANGES_REQUESTED**
- Security issues at severity HIGH or CRITICAL block approval
- Architecture violations block approval
- Code quality below threshold triggers improvement cycle
- All four reviewer perspectives must be represented
- Cross-agent escalation: same area flagged by 2+ agents = auto-blocker
- Override: only if project declares `coding_pattern: <alternative>` in `governance/brain/architecture.md`

## State Updates
- `current-project.json`: update last_review
- `sprint-state.json`: record review outcome and scores
- `context-state.json`: update loaded_rules with review findings

## Output
```
Deep Review Complete (Independent/Isolated)
  Sprint: {sprint_id}

  SOLID Compliance: {score}/5 — {S}|{O}|{L}|{I}|{D} individual scores
  Code Review:      {score}/5 — {summary}
  Security Review:  {score}/5 — {summary}
  Architecture:     {score}/5 — {summary}
  QA Verification:  {score}/5 — {summary}
  E2E Testing:      {passed}/{total} criteria — {PASS|FAIL|SKIPPED}

  Cross-Agent Escalations: {n} (areas flagged by multiple agents)

  Critical Issues: {n}
  Improvements:    {n}
  Suggestions:     {n}

  Overall: {APPROVED|CHANGES_REQUESTED|BLOCKED}
  Next: /build-learn (if approved) or /build-execute (fix issues)
```
