# Java / Spring Boot Standards

Language-specific engineering standards for Java and Spring Boot projects.

## Design Standards

### Project Structure
```
src/main/java/com/company/project/
  ├── config/          # Spring configuration classes
  ├── controller/      # REST controllers (thin, delegation only)
  ├── service/         # Business logic layer
  ├── repository/      # Data access layer (Spring Data)
  ├── model/
  │   ├── entity/      # JPA entities
  │   ├── dto/         # Data transfer objects
  │   └── domain/      # Domain value objects
  ├── exception/       # Custom exceptions and handlers
  ├── security/        # Security configuration and filters
  └── util/            # Utility classes (stateless, static)
```

### Layered Architecture Rules
- Controllers only handle HTTP concerns: request parsing, response formatting, status codes (SRP)
- Services contain all business logic; they never reference HttpServletRequest or ResponseEntity (SRP)
- Repositories handle data access only; no business logic in queries (SRP)
- DTOs are used at API boundaries; entities never leak to controllers
- Use mappers (MapStruct preferred) for entity-to-DTO conversions
- Use strategy/template method patterns for varying business rules, not switch statements (OCP)
- Keep interfaces focused per role: separate read and write contracts when appropriate (ISP)
- Subclasses must fully honor parent contracts — no UnsupportedOperationException in overrides (LSP)

### Dependency Injection (DIP)
- Use constructor injection exclusively (no field injection with @Autowired)
- Mark injected dependencies as `final`
- Use `@RequiredArgsConstructor` from Lombok for concise constructors
- **Always inject interface types, never concrete implementations** (DIP — hard governance)
- Define service interfaces in the domain layer; implementations in infrastructure
- No service class should directly instantiate its dependencies

## Naming Conventions

### Classes
- Controllers: `UserController`, `OrderController`
- Services: `UserService`, `OrderService` (interface) + `UserServiceImpl` only if multiple implementations
- Repositories: `UserRepository`, `OrderRepository`
- DTOs: `CreateUserRequest`, `UserResponse`, `UpdateOrderRequest`
- Entities: `User`, `Order`, `OrderItem` (no suffix)
- Exceptions: `UserNotFoundException`, `InsufficientBalanceException`
- Config: `SecurityConfig`, `DatabaseConfig`, `CacheConfig`

### Methods
- Service methods: `createUser`, `findUserById`, `updateOrderStatus`
- Repository methods: follow Spring Data naming conventions
- Controller methods: `getUser`, `createUser`, `updateUser`, `deleteUser`
- Boolean methods: `isActive()`, `hasPermission()`, `canAccess()`

### Packages
- Use lowercase, dot-separated: `com.company.project.service`
- Group by feature for large projects: `com.company.project.user.service`

## Test Expectations

### Unit Tests
- Use JUnit 5 with AssertJ assertions (not Hamcrest)
- Use Mockito for mocking dependencies
- Test file naming: `UserServiceTest.java`
- Use `@DisplayName` for readable test descriptions
- Use `@Nested` classes to group related tests
- Use `@ParameterizedTest` for testing multiple inputs

### Integration Tests
- Use `@SpringBootTest` with `@AutoConfigureMockMvc` for controller tests
- Use `@DataJpaTest` for repository tests with H2 or Testcontainers
- Use `@WebMvcTest` for controller-only tests without full context
- Use Testcontainers for database integration tests in CI
- Test file naming: `UserControllerIntegrationTest.java`

### Test Structure
```java
@Test
@DisplayName("should return 404 when user does not exist")
void shouldReturn404WhenUserDoesNotExist() {
    // Arrange
    when(userService.findById(999L)).thenReturn(Optional.empty());

    // Act & Assert
    mockMvc.perform(get("/api/users/999"))
        .andExpect(status().isNotFound());
}
```

## Security Constraints

### Spring Security Configuration
- Use `SecurityFilterChain` bean (not extending `WebSecurityConfigurerAdapter`)
- Define explicit security rules; never rely on defaults
- Use method-level security (`@PreAuthorize`) for fine-grained access control
- Configure CORS explicitly; never use `permitAll()` for CORS in production
- Disable CSRF only for stateless APIs using JWT

### Input Validation
- Use Bean Validation annotations (`@NotNull`, `@Size`, `@Email`, `@Pattern`)
- Validate all request DTOs with `@Valid` in controller methods
- Create custom validators for complex business rules
- Sanitize HTML content with libraries like OWASP Java HTML Sanitizer

### Database Security
- Always use parameterized queries (JPA handles this; never concatenate SQL)
- Use `@Query` with named parameters: `@Query("SELECT u FROM User u WHERE u.email = :email")`
- Never expose entity IDs that reveal record counts (consider UUIDs)

## Performance Expectations

### Database
- Enable query logging in development to detect N+1 queries
- Use `@EntityGraph` or `JOIN FETCH` for eager loading when needed
- Implement pagination with `Pageable` for all list endpoints
- Use database indexes for columns in WHERE, JOIN, ORDER BY clauses
- Configure connection pool sizing (HikariCP: min 5, max 20 as baseline)

### Caching
- Use Spring Cache abstraction with `@Cacheable`, `@CacheEvict`, `@CachePut`
- Define cache TTLs explicitly; never cache indefinitely
- Use Redis for distributed caching in multi-instance deployments
- Cache read-heavy, write-light data (reference data, user profiles)

### Async Processing
- Use `@Async` with custom thread pool executor for background tasks
- Use `CompletableFuture` for composing async operations
- Implement proper error handling in async methods
- Use message queues (RabbitMQ, Kafka) for inter-service async communication

## Anti-Patterns

### Code Smells
- **Anemic domain model**: Entities with only getters/setters and no behavior
- **Service god class**: Service with 20+ methods handling unrelated concerns
- **Catch-and-ignore**: Empty catch blocks or catching Exception broadly
- **Stringly-typed code**: Using String where enum or value object is appropriate
- **Business logic in controllers**: Controllers doing more than delegation
- **Repository logic in service**: Complex SQL/JPQL that should be in repository

### Spring-Specific Anti-Patterns
- Using `@Autowired` on fields instead of constructor injection
- Circular dependencies between beans
- Using `@Transactional` on non-public methods (it has no effect)
- Returning entities directly from controllers instead of DTOs
- Not using profiles for environment-specific configuration
- Using `@ComponentScan` with overly broad base packages

## Review Checklist

- [ ] Constructor injection used for all dependencies
- [ ] DTOs used at API boundaries (no entity leakage)
- [ ] Bean Validation annotations on all request DTOs
- [ ] Proper exception handling with `@ControllerAdvice`
- [ ] Database queries are optimized (no N+1, proper indexes)
- [ ] Transactions are scoped correctly (`@Transactional` on service methods)
- [ ] Tests use appropriate Spring test slices
- [ ] Logging uses SLF4J with parameterized messages (no string concatenation)
- [ ] Configuration externalized (no hardcoded values)
- [ ] API versioning follows project convention
- [ ] Actuator endpoints are secured in production
- [ ] OpenAPI/Swagger documentation is generated and accurate
