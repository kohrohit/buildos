# Global Engineering Rules

Universal engineering discipline standards that apply to every project, language, and framework.

## Design Standards

### Separation of Concerns
- Each module, class, or function has a single, well-defined responsibility
- Business logic is separated from infrastructure concerns (database, HTTP, messaging)
- Configuration is separated from code and injected via environment
- Presentation logic never contains business rules

### Dependency Management
- Dependencies flow inward: outer layers depend on inner layers, never the reverse
- Use dependency injection to decouple components
- Prefer composition over inheritance
- Limit transitive dependencies; audit dependency trees regularly
- Pin dependency versions in production; use lock files

### API Design
- APIs are contracts; breaking changes require versioning
- Use consistent naming across all endpoints
- Return meaningful error responses with error codes
- Document all public APIs with examples
- Validate all inputs at the boundary layer

## Naming Conventions

### General Rules
- Names reveal intent: `calculateTotalPrice` not `calc` or `doStuff`
- Boolean variables start with `is`, `has`, `can`, `should`: `isActive`, `hasPermission`
- Collections use plural nouns: `users`, `orderItems`
- Avoid abbreviations unless universally understood (`id`, `url`, `http`)
- Constants use UPPER_SNAKE_CASE: `MAX_RETRY_COUNT`
- Avoid prefixes like `I` for interfaces or `Abstract` for base classes unless language convention demands it

### File and Directory Naming
- Use kebab-case for file names: `user-service.ts`, `order-repository.py`
- Group files by feature or domain, not by technical layer
- Test files mirror source file names with `.test` or `_test` suffix
- Configuration files use descriptive names: `database.config.ts` not `config2.ts`

## Test Expectations

### Coverage Requirements
- Minimum 80% line coverage for all projects
- Minimum 90% coverage for critical business logic
- 100% coverage for shared libraries and utility functions
- No merges that reduce overall coverage below threshold

### Test Quality
- Every test has a clear arrangement, action, and assertion (AAA pattern)
- Test names describe the behavior being verified: `should_return_404_when_user_not_found`
- Tests are independent and can run in any order
- Tests do not depend on external services (mock external dependencies)
- Tests run deterministically (no flaky tests in CI)
- Each test verifies one behavior (no multi-assertion tests without clear reason)

### Test Types Required
- Unit tests for all business logic and utility functions
- Integration tests for API endpoints and database operations
- Contract tests for inter-service communication
- Smoke tests for deployment verification

## Security Constraints

### Authentication and Authorization
- Never store plaintext passwords; use bcrypt, scrypt, or Argon2
- Implement token expiry and rotation for all auth tokens
- Apply principle of least privilege for all access controls
- Log all authentication events (login, logout, failed attempts)

### Data Protection
- Encrypt PII at rest and in transit (TLS 1.2+ for all communication)
- Never log sensitive data (passwords, tokens, credit card numbers, SSNs)
- Implement data retention policies; delete data when no longer needed
- Sanitize all user inputs to prevent injection attacks

### Secrets Management
- Never commit secrets to version control
- Use environment variables or secrets managers for credentials
- Rotate secrets on a regular schedule
- Use different secrets per environment (dev, staging, prod)

## Performance Expectations

### Response Time
- API responses: p95 < 200ms for reads, p95 < 500ms for writes
- Database queries: p95 < 50ms (flag queries exceeding 100ms)
- Background jobs: complete within defined SLA per job type

### Resource Efficiency
- Implement pagination for all list endpoints (default page size: 20, max: 100)
- Use connection pooling for database and HTTP connections
- Implement caching for frequently accessed, rarely changed data
- Avoid loading unnecessary data (select specific columns, use projections)

### Scalability
- Design stateless services that can scale horizontally
- Use message queues for async processing and decoupling
- Implement circuit breakers for external service calls
- Define and monitor rate limits for all public APIs

## Anti-Patterns

### Code Smells to Reject
- **God classes/functions**: Any class > 300 lines or function > 50 lines needs refactoring
- **Deep nesting**: Max 3 levels of nesting; refactor with early returns or extraction
- **Primitive obsession**: Use value objects for domain concepts (Money, Email, PhoneNumber)
- **Feature envy**: Methods that access another object's data more than their own
- **Shotgun surgery**: Changes that require modifying many files indicate poor encapsulation
- **Copy-paste code**: Any duplicated block > 5 lines must be extracted

### Infrastructure Anti-Patterns
- Hardcoded URLs, ports, or hostnames
- Missing health checks or readiness probes
- No timeout on external HTTP calls
- Missing retry logic with exponential backoff
- Logging to stdout without structured format

## Review Checklist

- [ ] Code follows single responsibility principle
- [ ] Names are clear, descriptive, and consistent
- [ ] All inputs are validated at boundaries
- [ ] Error handling is complete with meaningful messages
- [ ] Tests cover happy path, edge cases, and error scenarios
- [ ] No hardcoded secrets or environment-specific values
- [ ] Performance-sensitive paths are optimized
- [ ] Logging is present at appropriate levels (no sensitive data)
- [ ] Dependencies are minimal and justified
- [ ] Documentation is updated for public API changes
- [ ] No compiler warnings or linter errors
- [ ] Database queries are optimized with appropriate indexes
