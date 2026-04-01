# E2E Test Plan: [Sprint Name]

## Sprint
- **Sprint ID**: [SPRINT-ID]
- **Base URL**: [http://localhost:3000]
- **Browser**: Chromium (headless)

## Acceptance Criteria → Test Mapping

| AC ID | Criterion | Test File | Status |
|-------|-----------|-----------|--------|
| AC-01 | [Criterion from spec] | `tests/journeys/[name].spec.ts` | pending |
| AC-02 | [Criterion from spec] | `tests/journeys/[name].spec.ts` | pending |

## Pages Identified

| Page | URL | Page Object | Key Elements |
|------|-----|-------------|-------------|
| [Login] | `/login` | `pages/login.page.ts` | email input, password input, submit button |
| [Dashboard] | `/dashboard` | `pages/dashboard.page.ts` | welcome text, nav menu |

## Smoke Tests

| Test | What It Checks | Priority |
|------|---------------|----------|
| App loads | Base URL returns 200, no console errors | Critical |
| Key pages render | Each identified page loads without error | Critical |
| Auth flow | Login with test credentials succeeds | Critical (if auth required) |

## Test Data

| Data | Purpose | Cleanup |
|------|---------|---------|
| [test user credentials] | Auth flow testing | N/A (pre-seeded) |
| [generated test data] | Journey testing | Delete after test |

## Environment Requirements

- [ ] App running at base URL
- [ ] Playwright installed (`npx playwright install chromium`)
- [ ] Test credentials available
- [ ] Test database seeded (if applicable)

## Run Commands

```bash
# Full suite
npx playwright test --config=e2e/playwright.config.ts

# Smoke only
npx playwright test tests/smoke/ --config=e2e/playwright.config.ts

# Specific criterion
npx playwright test -g "AC-01" --config=e2e/playwright.config.ts

# With UI (debugging)
npx playwright test --ui --config=e2e/playwright.config.ts

# Show report
npx playwright show-report e2e/reports/html
```
