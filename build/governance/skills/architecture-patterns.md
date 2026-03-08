# Architecture Patterns

Reusable reference for common architecture patterns, their trade-offs, and when to apply them.

## Layered Architecture

### Description
Organizes code into horizontal layers (presentation, business logic, data access) where each layer only depends on the layer directly below it.

### When to Use
- Small to medium applications with straightforward CRUD operations
- Teams with mixed experience levels (clear separation aids understanding)
- Applications where business logic complexity is moderate
- Projects that need fast initial delivery

### When to Avoid
- Large applications with complex domain logic (consider hexagonal instead)
- Systems requiring high independence between components
- Microservice environments where layers span service boundaries

### Key Rules
- Dependencies flow downward only: presentation -> service -> repository -> database
- Each layer exposes interfaces consumed by the layer above
- DTOs at boundaries between layers prevent leakage
- Cross-cutting concerns (logging, auth) use middleware or AOP, not layer violations

### Common Mistakes
- Skipping layers (controller calling repository directly)
- Business logic in controllers or repositories
- Entities leaking to the presentation layer
- Layers that are pass-through without adding value

## Hexagonal Architecture (Ports and Adapters)

### Description
Isolates the core domain from external concerns by defining ports (interfaces) that the domain exposes and adapters that implement those interfaces for specific technologies.

### When to Use
- Applications with complex domain logic that must be technology-independent
- Systems that need to swap infrastructure components (database, messaging, APIs)
- Projects with strong testing requirements (domain testable without infrastructure)
- Long-lived applications expected to outlive their current technology choices

### When to Avoid
- Simple CRUD applications (overhead not justified)
- Prototypes or MVPs where speed matters more than flexibility
- Very small teams unfamiliar with the pattern

### Key Rules
- Domain core has zero dependencies on frameworks or infrastructure
- Ports are interfaces defined by the domain
- Adapters implement ports and live outside the domain
- Application services orchestrate domain operations
- Dependency inversion: infrastructure depends on domain, not vice versa

### Structure
```
domain/           # Pure business logic, no framework imports
  ├── models/     # Entities and value objects
  ├── services/   # Domain services
  └── ports/      # Interface definitions (repository ports, event ports)
application/      # Use cases / application services
  └── commands/   # Command handlers orchestrating domain operations
adapters/
  ├── inbound/    # REST controllers, GraphQL resolvers, CLI handlers
  └── outbound/   # Database repositories, API clients, message publishers
```

## Event-Driven Architecture

### Description
Components communicate through events rather than direct calls. Producers emit events; consumers react to them asynchronously.

### When to Use
- Systems requiring loose coupling between components
- Workflows that span multiple services or bounded contexts
- Applications needing audit trails (events are natural audit logs)
- Systems with varying processing speeds (events buffer load)

### When to Avoid
- Simple request-response flows where synchronous calls suffice
- When strong consistency is required and eventual consistency is unacceptable
- Small monoliths where direct function calls are simpler

### Key Rules
- Events are immutable facts about something that happened
- Event names use past tense: `OrderPlaced`, `UserRegistered`, `PaymentProcessed`
- Events carry sufficient data for consumers to process without callbacks
- Consumers are idempotent (processing the same event twice produces the same result)
- Use a schema registry or typed events to ensure compatibility

### Patterns
- **Event Notification**: Lightweight event triggers consumers to fetch data
- **Event-Carried State Transfer**: Event contains all data consumers need
- **Event Sourcing**: Events are the source of truth; state is derived from event history

## CQRS (Command Query Responsibility Segregation)

### Description
Separates read operations (queries) from write operations (commands) into distinct models, potentially with different data stores optimized for each.

### When to Use
- Read and write workloads have significantly different patterns
- Complex queries that are expensive to compute from the write model
- Systems needing different scaling for reads vs writes
- Combined with Event Sourcing for event-driven systems

### When to Avoid
- Simple CRUD where read and write models are identical
- Small applications where the added complexity is not justified
- Teams unfamiliar with the pattern (high learning curve)

### Key Rules
- Commands change state and return void (or just a created ID)
- Queries return data and have no side effects
- Write model is optimized for consistency and validation
- Read model is optimized for query performance (denormalized, pre-computed)
- Eventual consistency between write and read models is expected

### Implementation Levels
1. **Code-level**: Separate service methods for commands and queries (same database)
2. **Model-level**: Different models for reads and writes (same database, different tables/views)
3. **Store-level**: Different databases for reads and writes (full CQRS)

## Microservices

### Description
System is decomposed into small, independently deployable services, each owning its data and communicating over the network.

### When to Use
- Large teams that need to deploy independently
- Systems with components that scale at different rates
- Organizations adopting DevOps with independent team ownership
- Systems where different components have different technology requirements

### When to Avoid
- Small teams (< 5 engineers) where coordination overhead exceeds benefit
- Early-stage products where domain boundaries are unclear
- When network latency and distributed system complexity are unacceptable
- When the team lacks infrastructure maturity (CI/CD, monitoring, observability)

### Key Rules
- Each service owns its data (no shared databases)
- Services communicate through well-defined APIs or events
- Deploy independently; a change to one service does not require redeploying others
- Design for failure: circuit breakers, retries, timeouts, fallbacks
- Service boundaries align with domain boundaries (bounded contexts)
- Shared logic lives in libraries, not shared services

### Essential Infrastructure
- Service discovery and load balancing
- Centralized logging and distributed tracing
- Container orchestration (Kubernetes or equivalent)
- CI/CD per service with independent pipelines
- API gateway for external traffic routing

## Decision Framework

| Factor | Layered | Hexagonal | Event-Driven | CQRS | Microservices |
|--------|---------|-----------|--------------|------|---------------|
| Team size | Small | Medium | Medium-Large | Medium | Large |
| Domain complexity | Low-Med | High | Medium | High | Varies |
| Scalability needs | Low | Medium | High | High | Very High |
| Initial velocity | Fast | Medium | Slow | Slow | Slow |
| Operational cost | Low | Low | Medium | Medium | High |
| Testability | Medium | Very High | Medium | High | High |
