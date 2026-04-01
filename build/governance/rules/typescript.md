# TypeScript / Node.js Standards

Language-specific engineering standards for TypeScript and Node.js projects.

## Design Standards

### Project Structure
```
src/
  ├── modules/
  │   └── <module>/
  │       ├── <module>.controller.ts   # HTTP handling
  │       ├── <module>.service.ts      # Business logic
  │       ├── <module>.repository.ts   # Data access
  │       ├── <module>.model.ts        # Types and interfaces
  │       ├── <module>.schema.ts       # Validation schemas (Zod)
  │       ├── <module>.router.ts       # Route definitions
  │       └── __tests__/
  ├── common/
  │   ├── middleware/
  │   ├── errors/
  │   ├── utils/
  │   └── types/
  ├── config/
  │   ├── database.ts
  │   ├── env.ts                       # Environment validation
  │   └── logger.ts
  ├── app.ts                           # Express/Fastify setup
  └── server.ts                        # Entry point
```

### Architecture Rules
- Controllers parse requests and format responses; no business logic (SRP)
- Services contain business logic; they accept typed inputs and return typed outputs (SRP)
- Repositories handle data access; services never import database clients directly (DIP)
- Use Zod schemas for runtime validation at API boundaries
- Use TypeScript interfaces for compile-time contracts between layers (DIP)
- All async functions return `Promise<T>` with explicit return types
- Define interfaces in the domain/business layer; implement in infrastructure (DIP)
- Use strategy/factory patterns for behavior variants instead of conditionals (OCP)
- Keep interfaces focused: one interface per role/capability (ISP)
- Subtypes must honor base type contracts — no throwing overrides (LSP)

### Module Boundaries
- Modules communicate through their public interfaces (exported types and services)
- No circular dependencies between modules
- Shared code lives in `common/` and is generic (not business-specific)
- Each module owns its database tables and migrations

## Naming Conventions

### Files
- Use kebab-case with layer suffix: `user.service.ts`, `order.repository.ts`
- Test files: `user.service.test.ts` (co-located in `__tests__/`)
- Types/interfaces: `user.model.ts`, `order.model.ts`
- Schemas: `user.schema.ts` (Zod validation schemas)

### Code
- Interfaces: `PascalCase` with no `I` prefix: `UserService`, `OrderRepository`
- Types: `PascalCase`: `CreateUserInput`, `UserResponse`
- Functions and variables: `camelCase`: `createUser`, `orderTotal`
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config objects
- Enums: `PascalCase` name, `PascalCase` members: `enum OrderStatus { Pending, Shipped }`
- Generic types: descriptive single letter or short name: `T`, `TEntity`, `TResponse`

### Express/Fastify Patterns
- Route handlers: `getUser`, `createOrder`, `updateOrderStatus`
- Middleware: descriptive verb: `authenticateToken`, `validateBody`, `rateLimitRequests`
- Error classes: `NotFoundError`, `ValidationError`, `UnauthorizedError`

## Test Expectations

### Framework and Tools
- Use `vitest` or `jest` as test runner
- Use `supertest` for HTTP integration tests
- Use `@faker-js/faker` for test data generation
- Use dependency injection for testable service design

### Test Structure
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const input: CreateUserInput = { name: 'Alice', email: 'alice@test.com' };
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({ id: '1', ...input });

      // Act
      const result = await userService.createUser(input);

      // Assert
      expect(result.name).toBe('Alice');
      expect(mockUserRepo.create).toHaveBeenCalledWith(input);
    });

    it('should throw ConflictError for duplicate email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.createUser(input)).rejects.toThrow(ConflictError);
    });
  });
});
```

### Coverage Configuration
- Configure in `vitest.config.ts` or `jest.config.ts`
- Exclude: `node_modules`, `dist`, `*.config.*`, `__mocks__`
- Report formats: `text`, `lcov` (for CI), `html` (for local review)

## Security Constraints

### Input Validation
- Validate all request bodies with Zod schemas
- Use `z.string().email()`, `z.string().url()`, `z.string().uuid()` for format validation
- Set explicit `maxLength` on all string fields
- Use `z.coerce` for query parameters that need type conversion
- Never use `JSON.parse` on user input without schema validation after

### Authentication
- Use `jsonwebtoken` with RS256 (asymmetric) for production tokens
- Store refresh tokens in httpOnly, secure, sameSite cookies
- Implement token rotation on refresh
- Use middleware chain for auth: `authenticate -> authorize -> handler`

### Environment
- Validate all environment variables at startup with Zod
- Fail fast if required variables are missing
- Use `dotenv` only for local development
- Never interpolate user input into shell commands (`child_process`)

## Performance Expectations

### Async Patterns
- Use `async/await` consistently (no mixing with `.then()` chains)
- Use `Promise.all` for independent concurrent operations
- Use `Promise.allSettled` when partial failure is acceptable
- Implement proper error handling in all async paths
- Set timeouts on all outbound HTTP requests and database queries

### Database (Prisma / TypeORM / Drizzle)
- Use connection pooling with appropriate pool size
- Implement pagination for all list queries
- Use transactions for multi-step writes: `prisma.$transaction()`
- Create indexes for frequently queried columns
- Use `select` to fetch only needed columns

### Memory and CPU
- Stream large responses instead of buffering
- Use worker threads for CPU-intensive operations
- Implement request body size limits
- Monitor event loop lag and set alerts
- Avoid synchronous file operations in request handlers

## Anti-Patterns

### TypeScript Anti-Patterns
- **`any` type**: Never use `any`; use `unknown` and narrow with type guards
- **Type assertions abuse**: Avoid `as Type`; prefer type narrowing
- **Non-null assertion**: Avoid `!` operator; handle null/undefined explicitly
- **Barrel file hell**: Avoid deep re-export chains that slow builds
- **Enum misuse**: Prefer union types for simple cases: `type Status = 'active' | 'inactive'`
- **Optional chaining excess**: `a?.b?.c?.d` suggests poor type modeling

### Node.js Anti-Patterns
- Callback-style code (use async/await)
- Unhandled promise rejections (always catch or let error middleware handle)
- Blocking the event loop with synchronous operations
- Memory leaks from uncleared timers, event listeners, or closures
- Using `require()` instead of ES module `import`
- Not validating environment variables at startup

### Express/Fastify Anti-Patterns
- Business logic in route handlers
- Missing error handling middleware
- Not setting security headers (use `helmet`)
- Missing rate limiting on public endpoints
- Not parsing `Content-Type` correctly

## Review Checklist

- [ ] Strict TypeScript: `strict: true` in tsconfig, no `any` usage
- [ ] All API inputs validated with Zod schemas
- [ ] Async/await used correctly with error handling
- [ ] No circular dependencies between modules
- [ ] Tests cover happy path, edge cases, and error scenarios
- [ ] Error classes extend a base AppError with status codes
- [ ] Environment variables validated at startup
- [ ] Security headers configured (helmet or equivalent)
- [ ] Rate limiting on public endpoints
- [ ] Logging uses structured format (pino or winston)
- [ ] Dependencies are up to date with no known vulnerabilities
- [ ] ESLint and Prettier pass with zero warnings
