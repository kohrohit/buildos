---
description: "Context-free E2E testing — generates and runs Playwright tests from acceptance criteria without seeing implementation code"
---

# /build-e2e — Context-Free E2E Testing (Playwright CLI)

## Purpose

Generate and execute end-to-end tests that verify the application behaves correctly **from the user's perspective**, using only acceptance criteria as input. The E2E tester agent never sees source code — it tests what the spec promises, not what the code does. This catches behavioral gaps that implementation-aware tests miss.

## Prerequisites

- Active sprint with acceptance criteria defined
- Application running and accessible at a known base URL
- Playwright installed (agent will install if missing)

## Context Pack

Orchestrator loads: sprint spec (stripped), acceptance criteria, API contracts, environment config.

**The E2E agent receives ONLY the spec context — never source code, architecture docs, or implementation details.**

## Steps

### 1. Validate Environment

```bash
# Check if app is running
curl -sf ${BASE_URL}/health || curl -sf ${BASE_URL} || echo "APP_NOT_RUNNING"

# Check if Playwright is available
npx playwright --version 2>/dev/null || echo "PLAYWRIGHT_NOT_INSTALLED"
```

If app is not running:
- Check sprint spec for start command (e.g., `npm run dev`, `python manage.py runserver`)
- Prompt user to start the app or provide the base URL
- Do NOT proceed without a reachable app

If Playwright is not installed:
- Run `npm init -y && npm install -D @playwright/test`
- Run `npx playwright install --with-deps chromium`

### 2. Prepare E2E Context (Context-Free)

Extract from sprint spec **ONLY**:
- User stories and acceptance criteria
- API routes / URL paths mentioned in spec
- UI descriptions (form fields, buttons, pages)
- Auth requirements (login flow, test credentials)
- Performance targets from NFRs (if applicable)

**Strip ALL of the following:**
- Source code references
- Implementation approach
- Architecture decisions
- Database schema
- Internal module structure
- Git history
- Previous test results

Assemble context:
```
## Acceptance Criteria
{extracted criteria, numbered AC-01, AC-02, ...}

## Known Routes / Pages
{URLs and page descriptions from spec}

## Auth Flow
{login mechanism, test credentials if provided}

## Environment
BASE_URL: {url}
```

### 3. Spawn E2E Tester Agent (Isolated)

```
Agent(isolation: "worktree")
```

**Prompt preamble:**
> *"You are testing an application you have never seen before. You do not know how it was built, what framework it uses, or how the code is structured. You know only what the application should do (acceptance criteria) and where it runs (base URL). Your job is to verify every acceptance criterion through the browser using Playwright. Generate tests, run them, report results. If the app doesn't match the spec, that's a failure — no excuses."*

**Pass to agent:**
- Stripped acceptance criteria
- Known routes/pages
- Auth flow and test credentials
- Base URL
- E2E tester agent definition (`governance/agents/e2e-tester.md`)

**Agent does NOT receive:**
- Source code or file listings
- Architecture spec
- Implementation reasoning
- Previous review findings
- Database schema or migrations

### 4. Agent Workflow

The spawned agent executes these phases:

#### Phase A: Scaffold (if first run)

Create Playwright project structure:
```
e2e/
  ├── playwright.config.ts
  ├── pages/           # Page Object Model classes
  ├── fixtures/        # Auth helpers, test data
  ├── tests/
  │   ├── smoke/       # App loads, key pages render
  │   ├── journeys/    # Acceptance criteria tests
  │   └── regression/  # Bug-fix regression tests
  └── reports/
```

#### Phase B: Generate Smoke Tests

Before testing criteria, verify the app is functional:
- App loads at base URL
- Key pages from spec render without errors
- No console errors on page load
- Auth flow works with test credentials

```bash
npx playwright test tests/smoke/ --reporter=list
```

If smoke tests fail → report immediately, skip journey tests.

#### Phase C: Generate Journey Tests

For each acceptance criterion:
1. Create a test that exercises the criterion through the browser
2. Use Page Object Model for page interactions
3. Use accessible locators (getByRole, getByLabel, getByText)
4. Assert the expected outcome from the acceptance criterion
5. Add screenshot capture on failure

```bash
npx playwright test tests/journeys/ --reporter=html,json --trace=on-first-retry --retries=1
```

#### Phase D: Capture Results

- Parse `e2e/reports/results.json` for pass/fail per test
- Map test results back to acceptance criteria (AC-01, AC-02, ...)
- Collect screenshots and traces for failures
- Identify flaky tests (passed on retry)
- Generate E2E verification report

### 5. Produce E2E Report

Write report to `state/reports/{sprint-id}-e2e.md`:

```
E2E Test Report — Context-Free (Playwright CLI)
  Sprint: {sprint_id}
  Base URL: {base_url}
  Browser: Chromium (headless)
  Generated: {timestamp}

  Smoke Tests:
    ✓ App loads — PASS
    ✓ Login page renders — PASS
    ✓ Auth flow works — PASS

  Acceptance Criteria Results:
    ✓ AC-01: {criterion} — PASS
    ✗ AC-02: {criterion} — FAIL
        Screenshot: e2e/reports/results/{name}.png
        Expected: {what spec says}
        Actual: {what happened}
    ⚠ AC-03: {criterion} — FLAKY

  Summary:
    Total:    {n} tests
    Passed:   {n}
    Failed:   {n}
    Flaky:    {n}
    Skipped:  {n}

  Criteria Coverage: {passed}/{total} ({percentage}%)

  Verdict: {PASSED | CHANGES_REQUESTED | BLOCKED}

  Artifacts:
    HTML Report: e2e/reports/html/index.html
    JSON Results: e2e/reports/results.json
    Screenshots: e2e/reports/results/*.png
    Traces: e2e/reports/results/*.zip
```

### 6. Integrate Results

- Update `state/sprint-state.json` with E2E results
- If any acceptance criterion fails → verdict is `CHANGES_REQUESTED`
- If smoke tests fail → verdict is `BLOCKED`
- Flaky tests are logged as `should-fix`, not blockers
- Results feed into `/build-verify` and `/build-review` as additional data

## Governance Checks

- **Smoke failure blocks all further E2E testing** — fix the app first
- **Any failed acceptance criterion = must-fix** — the spec is the contract
- **Flaky tests must be resolved within 2 sprints** — logged as should-fix
- **Context-free mandate is absolute** — if the agent requests source code, reject and re-prompt
- **Accessible locators required** — tests using CSS classes/XPath without justification are rejected
- **Page Object Model required** — raw locators in test files are rejected

## Integration with Other Commands

### /build-verify
E2E results are included in the verification report. If E2E verdict is `CHANGES_REQUESTED` or `BLOCKED`, the overall verification cannot be `approved`.

### /build-review
E2E report is passed to the QA Verifier agent as additional context during blind review. The QA agent validates that E2E coverage is proportional (≤10% of total test suite).

### /build-execute
During task execution, the agent can run `npx playwright test tests/smoke/` as a quick sanity check after implementing a feature.

## Running Modes

| Mode | Command | When to Use |
|------|---------|-------------|
| Full E2E | `/build-e2e` | After sprint execution, before verify |
| Smoke only | `/build-e2e --smoke` | Quick sanity check during development |
| Single criterion | `/build-e2e --ac AC-03` | Re-test a specific acceptance criterion |
| Regenerate | `/build-e2e --regen` | Regenerate tests from updated spec |
| Report only | `/build-e2e --report` | Re-read existing results without running |

## State Updates

- `sprint-state.json`: add `e2e_verdict`, `e2e_passed`, `e2e_failed`, `e2e_flaky`
- `context-state.json`: update with E2E report location
- `state/reports/{sprint-id}-e2e.md`: full report

## Output

```
E2E Testing Complete (Context-Free / Playwright CLI)
  Sprint: {sprint_id}
  
  Smoke: {PASS|FAIL}
  Criteria: {passed}/{total} ({percentage}%)
  Flaky: {n}
  
  Verdict: {PASSED|CHANGES_REQUESTED|BLOCKED}
  Report: e2e/reports/html/index.html
  
  Next: /build-verify (if passed) or /build-execute (fix failures)
```
