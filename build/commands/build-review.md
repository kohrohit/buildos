---
description: "Deep governance review with code, security, and architecture review agents"
---

# /build-review — Deep Governance Review

## Purpose
Perform a thorough multi-perspective review simulating code-reviewer, security-reviewer, and architect agents. Checks non-functional requirements, architecture alignment, security posture, and code quality at a deeper level than /build-verify.

## Context Pack
Load: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`, `context/review-context.md`

Also load: `state/sprint-state.json`, `state/task-state.json`, `state/learned-patterns.json`

## Steps

1. **Prepare review scope**
   - Gather all files modified in current sprint
   - Load sprint deliverables and acceptance criteria
   - Load previous review findings (if any)

2. **Code Reviewer Agent**
   - Review code quality: readability, maintainability, DRY
   - Check test coverage adequacy
   - Review error handling completeness
   - Check documentation quality (comments, JSDoc, docstrings)
   - Score: 1-5 on each dimension

3. **Security Reviewer Agent**
   - Check for hardcoded secrets or credentials
   - Review input validation and sanitization
   - Check authentication/authorization patterns
   - Review dependency security (known vulnerabilities)
   - Check for common vulnerability patterns (injection, XSS, CSRF)
   - Score: 1-5 on each dimension

4. **Architect Agent**
   - Verify module boundaries and coupling
   - Check dependency direction compliance
   - Review interface contracts and API design
   - Assess scalability and extensibility
   - Check conformance with architecture decision records
   - Score: 1-5 on each dimension

5. **NFR Assessment**
   - Performance: any obvious bottlenecks or anti-patterns
   - Reliability: error recovery, graceful degradation
   - Observability: logging, metrics, tracing readiness
   - Maintainability: complexity assessment

6. **Synthesize review**
   - Aggregate scores across all reviewers
   - Identify critical issues (must-fix)
   - Identify improvements (should-fix)
   - Identify suggestions (nice-to-have)

## Governance Checks
- Security issues at severity HIGH or CRITICAL block approval
- Architecture violations block approval
- Code quality below threshold triggers improvement cycle
- All three reviewer perspectives must be represented

## State Updates
- `current-project.json`: update last_review
- `sprint-state.json`: record review outcome and scores
- `context-state.json`: update loaded_rules with review findings

## Output
```
Deep Review Complete
  Sprint: {sprint_id}

  Code Review:     {score}/5 — {summary}
  Security Review: {score}/5 — {summary}
  Architecture:    {score}/5 — {summary}

  Critical Issues: {n}
  Improvements:    {n}
  Suggestions:     {n}

  Overall: {APPROVED|CHANGES_REQUESTED|BLOCKED}
  Next: /build-learn (if approved) or /build-execute (fix issues)
```
