# Testing Strategy

Operational knowledge for building an effective test suite that maximizes confidence while minimizing maintenance cost.

## Test Pyramid

### Unit Tests (70% of total tests)
- Test individual functions, methods, and classes in isolation
- Mock all external dependencies (database, APIs, file system)
- Execute in milliseconds; run on every save or commit
- Focus on business logic, calculations, transformations, and validations

### Integration Tests (20% of total tests)
- Test component interactions: API endpoints, database queries, message handlers
- Use real dependencies where practical (Testcontainers, in-memory databases)
- Execute in seconds; run on every pull request
- Focus on contracts between components and correct wiring

### End-to-End Tests (10% of total tests)
- Test complete user workflows through the full stack
- Use real or production-like environments
- Execute in minutes; run before deployment to staging/production
- Focus on critical user journeys (login, purchase, core workflows)

## Coverage Targets

| Scope | Line Coverage | Branch Coverage |
|-------|--------------|-----------------|
| Overall project | >= 80% | >= 75% |
| Critical business logic | >= 95% | >= 90% |
| Shared libraries / utilities | >= 95% | >= 90% |
| API endpoints | 100% happy path + error cases | >= 80% |
| New code (per PR) | >= 90% | >= 85% |
| Infrastructure / config | Not required | Not required |

### What NOT to Measure
- Do not chase 100% coverage on everything; it leads to brittle tests
- Exclude generated code, migrations, and configuration from coverage
- Exclude trivial getters/setters and data classes
- Focus on behavior coverage over line coverage

## What to Test

### Always Test
- Business rules and domain logic
- Input validation and error handling
- API request/response contracts
- Database queries with edge cases (empty results, duplicates)
- Authentication and authorization logic
- State transitions and workflow steps
- Data transformations and calculations
- Error recovery and fallback behavior

### Test Selectively
- Third-party library integrations (test your usage, not the library)
- Configuration loading (test at startup, not per-request)
- Logging output (verify critical audit events only)
- Cache behavior (test invalidation logic, not cache library)

### Skip Testing
- Framework boilerplate (router registration, middleware ordering)
- Auto-generated code (ORM models, GraphQL types)
- Simple pass-through functions with no logic
- CSS and styling (use visual regression tools instead)

## Test Design Principles

### AAA Pattern (Arrange, Act, Assert)
```
Arrange: Set up preconditions and inputs
Act:     Execute the behavior being tested
Assert:  Verify the expected outcome
```

### One Behavior Per Test
- Each test verifies exactly one behavior
- Test names describe the behavior: `should_return_404_when_user_not_found`
- Multiple assertions are acceptable if they verify one logical outcome
- Separate tests for separate behaviors, even if setup is similar

### Test Independence
- Tests run in any order and produce the same results
- Each test creates its own data and cleans up after itself
- No shared mutable state between tests
- Use factories or builders for test data, not shared fixtures

### Test Readability
- Tests are documentation; optimize for reading, not writing
- Use descriptive variable names: `expiredToken`, `adminUser`, `emptyOrder`
- Extract complex setup into named helper functions
- Keep tests flat (minimal nesting, no if/else in tests)

## Testing Patterns

### Test Doubles
- **Stub**: Returns predetermined data (use for queries/reads)
- **Mock**: Verifies interactions occurred (use for commands/writes)
- **Fake**: Working implementation with shortcuts (in-memory database)
- **Spy**: Records calls for later verification (logging, analytics)

### When to Mock
- External API calls (network is unreliable and slow)
- Time-dependent behavior (use a clock abstraction)
- Randomness (use a seeded random generator)
- File system operations (use in-memory filesystem)
- Third-party services (payment gateways, email services)

### When NOT to Mock
- Your own code within the same module (test the real thing)
- Database in integration tests (use Testcontainers or in-memory DB)
- Simple value objects and data transformations
- If you are mocking everything, the test is not testing anything

## Test Maintenance

### Avoiding Flaky Tests
- Never depend on timing or sleep in tests
- Use deterministic data (no random values without seeds)
- Isolate test environments (no shared databases or services)
- Retry network-dependent tests with proper assertions (E2E only)
- Fix flaky tests immediately; do not ignore them

### Test Refactoring
- Apply DRY to test setup, not to test assertions
- Extract shared setup into fixtures or factories
- Use parameterized tests for data-driven scenarios
- Delete tests that no longer correspond to behavior (dead tests)
- Refactor tests alongside production code

### Continuous Integration
- All tests run on every pull request
- Fast tests (unit) run first; slow tests (E2E) run last
- Fail the build on any test failure
- Report coverage with trends (flag decreases)
- Set maximum test suite execution time (fail if tests are too slow)

## Anti-Patterns

- **Testing implementation details**: Asserting internal method calls instead of outcomes
- **Snapshot overuse**: Snapshots for everything; changes trigger massive diffs
- **Ice cream cone**: More E2E than unit tests (inverted pyramid)
- **Test duplication**: Same behavior tested at multiple levels
- **Fragile locators**: E2E tests using CSS selectors that change frequently
- **Ignored tests**: `@Ignore`, `.skip`, or `xit` left permanently
- **Assertion-free tests**: Tests that only check "no exception thrown"
- **Over-mocking**: Mocking so much that the test does not verify real behavior
