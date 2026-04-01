# SOLID Principles — Hard Governance

Default coding pattern for all BuildOS projects. SOLID violations are **must-fix** and **block merges** unless the project explicitly declares an alternative pattern in `governance/brain/architecture.md`.

## Governance Policy

```
DEFAULT_PATTERN: SOLID
ENFORCEMENT: hard
SEVERITY: must-fix
OVERRIDE: only via explicit declaration in governance/brain/architecture.md
```

If a project's `architecture.md` contains a `coding_pattern:` field with a value other than `SOLID`, that pattern takes precedence. If no `coding_pattern:` is declared, SOLID applies automatically.

---

## S — Single Responsibility Principle (SRP)

**Rule:** Every class, module, and function has exactly one reason to change.

### What It Means
- A class should encapsulate one concern — not one method, but one *axis of change*
- If two changes for different business reasons touch the same class, it violates SRP
- Functions should do one thing, at one level of abstraction

### Violations That Block Merge
- **God class**: Class handling >1 domain concern (e.g., `UserService` that also sends emails and generates reports)
- **Mixed layers**: Business logic in controllers, HTTP concerns in services, SQL in domain models
- **Kitchen-sink utilities**: Utility class with unrelated methods (`StringUtils` that also handles dates)
- **Fat constructors**: Constructor that does work beyond assigning dependencies

### How to Fix
- Extract each responsibility into its own class/module
- Use composition: `OrderService` delegates to `OrderValidator`, `OrderPersistence`, `OrderNotifier`
- Apply "describe it in one sentence without 'and'" test

### Language-Specific Guidance

**TypeScript/Node.js:**
```typescript
// VIOLATION: Service handles validation, persistence, AND notification
class OrderService {
  async createOrder(data: CreateOrderInput) {
    // validates
    // saves to DB
    // sends email
    // publishes event
  }
}

// CORRECT: Each concern separated
class OrderService {
  constructor(
    private validator: OrderValidator,
    private repository: OrderRepository,
    private notifier: OrderNotifier,
  ) {}

  async createOrder(data: CreateOrderInput) {
    const validated = this.validator.validate(data);
    const order = await this.repository.save(validated);
    await this.notifier.orderCreated(order);
    return order;
  }
}
```

**Python:**
```python
# VIOLATION: View handles business logic
class OrderView(APIView):
    def post(self, request):
        # validates, calculates tax, saves, sends email...

# CORRECT: Thin view delegates to service
class OrderView(APIView):
    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = order_service.create_order(serializer.validated_data)
        return Response(OrderResponseSerializer(order).data, status=201)
```

**Java/Spring:**
```java
// VIOLATION: Service with mixed concerns
@Service
public class UserService {
    public User create(CreateUserDto dto) { /* saves */ }
    public void sendWelcomeEmail(User user) { /* emails */ }
    public Report generateActivityReport(Long userId) { /* reports */ }
}

// CORRECT: One responsibility per service
@Service
public class UserService { /* user CRUD only */ }

@Service
public class WelcomeEmailService { /* email concern */ }

@Service
public class UserReportService { /* reporting concern */ }
```

---

## O — Open/Closed Principle (OCP)

**Rule:** Software entities are open for extension, closed for modification.

### What It Means
- Add new behavior by adding new code, not changing existing code
- Use abstractions (interfaces, abstract classes, strategy pattern) as extension points
- Existing, tested code remains untouched when requirements grow

### Violations That Block Merge
- **Switch/if-else chains on type**: Adding a new type requires modifying existing function
- **Direct class modification for new variants**: Editing a class every time a new case appears
- **Hardcoded behavior selection**: No extension mechanism for varying behavior

### How to Fix
- Use Strategy pattern for varying algorithms
- Use Factory pattern for object creation with variants
- Use Plugin/Registry pattern for extensible feature sets
- Use polymorphism instead of conditionals on type

### Language-Specific Guidance

**TypeScript:**
```typescript
// VIOLATION: Must modify function for every new discount type
function calculateDiscount(type: string, amount: number): number {
  if (type === 'seasonal') return amount * 0.1;
  if (type === 'loyalty') return amount * 0.15;
  if (type === 'bulk') return amount * 0.2;
  // must edit here for every new type
}

// CORRECT: Open for extension via strategy
interface DiscountStrategy {
  calculate(amount: number): number;
}

class SeasonalDiscount implements DiscountStrategy {
  calculate(amount: number) { return amount * 0.1; }
}

// Add new discounts without touching existing code
class ReferralDiscount implements DiscountStrategy {
  calculate(amount: number) { return amount * 0.12; }
}
```

**Python:**
```python
# CORRECT: Registry pattern
from abc import ABC, abstractmethod

class PaymentProcessor(ABC):
    @abstractmethod
    def process(self, amount: Decimal) -> PaymentResult: ...

class StripeProcessor(PaymentProcessor): ...
class PayPalProcessor(PaymentProcessor): ...

# New processors added without modifying existing code
PROCESSORS: dict[str, type[PaymentProcessor]] = {
    "stripe": StripeProcessor,
    "paypal": PayPalProcessor,
}
```

---

## L — Liskov Substitution Principle (LSP)

**Rule:** Subtypes must be substitutable for their base types without altering program correctness.

### What It Means
- If code works with a base type, it must work identically with any subtype
- Subtypes must honor the base type's contract: preconditions, postconditions, invariants
- Overriding methods must not strengthen preconditions or weaken postconditions

### Violations That Block Merge
- **Exception in override**: Subclass throws unexpected exceptions the base contract doesn't declare
- **Broken invariants**: Subclass changes behavior the caller depends on (e.g., `ReadOnlyList.add()` throws)
- **Type checks on subtypes**: Code that does `if (x instanceof SpecificSubclass)` to handle special cases
- **Precondition strengthening**: Override rejects inputs the base method accepts

### How to Fix
- Use composition instead of inheritance when behavior varies significantly
- Ensure overrides honor base contracts exactly
- Use interface segregation (ISP) to avoid forced empty/throwing implementations
- Design by contract: document preconditions and postconditions

### Example
```typescript
// VIOLATION: Square breaks Rectangle's contract
class Rectangle {
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
}
class Square extends Rectangle {
  setWidth(w: number) { this.width = w; this.height = w; } // breaks caller expectations
}

// CORRECT: Separate types, shared interface
interface Shape {
  area(): number;
}
class Rectangle implements Shape { /* independent width/height */ }
class Square implements Shape { /* single side */ }
```

---

## I — Interface Segregation Principle (ISP)

**Rule:** No client should be forced to depend on methods it does not use.

### What It Means
- Prefer many small, focused interfaces over one large interface
- Each interface represents one role or capability
- Implementers should never have to stub or throw for unused methods

### Violations That Block Merge
- **Fat interface**: Interface with >7 methods covering multiple concerns
- **Empty/throwing implementations**: `throw new Error('Not implemented')` in an interface method
- **Forced dependencies**: Class imports an interface but only uses 2 of 10 methods
- **God interface**: Single interface that every module depends on

### How to Fix
- Split fat interfaces by role: `Readable`, `Writable`, `Deletable` instead of `Repository<T>`
- Use composition of interfaces: `class UserRepo implements Readable<User>, Writable<User>`
- Apply role interfaces: what does the *client* need, not what does the *server* offer

### Example
```typescript
// VIOLATION: Fat interface forces unused implementations
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  report(): void;
}

// Robot must implement eat() and sleep() — nonsensical
class Robot implements Worker {
  eat() { throw new Error('Robots do not eat'); } // ISP violation
}

// CORRECT: Segregated interfaces
interface Workable { work(): void; }
interface Feedable { eat(): void; }
interface Reportable { report(): void; }

class Robot implements Workable, Reportable { /* only relevant methods */ }
class Human implements Workable, Feedable, Reportable { /* all apply */ }
```

---

## D — Dependency Inversion Principle (DIP)

**Rule:** High-level modules must not depend on low-level modules. Both must depend on abstractions.

### What It Means
- Business logic never imports infrastructure directly (no `import { PrismaClient }` in a service)
- Define interfaces in the domain/business layer; implement them in the infrastructure layer
- Dependency direction: infrastructure -> domain, never domain -> infrastructure

### Violations That Block Merge
- **Direct infrastructure import in business logic**: Service importing database client, HTTP library, or file system
- **Concrete constructor parameters**: `constructor(private db: PrismaClient)` instead of interface
- **Missing abstraction**: No interface between layers — service directly calls repository implementation
- **Framework coupling**: Business logic that cannot be tested without the framework running

### How to Fix
- Define port interfaces in the domain layer
- Implement adapters in the infrastructure layer
- Use dependency injection to wire implementations at composition root
- Test business logic with mock implementations of interfaces

### Language-Specific Guidance

**TypeScript:**
```typescript
// VIOLATION: Service directly depends on Prisma
import { PrismaClient } from '@prisma/client';

class UserService {
  constructor(private prisma: PrismaClient) {}
}

// CORRECT: Service depends on abstraction
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

class UserService {
  constructor(private userRepo: UserRepository) {}
}

// Infrastructure implements the interface
class PrismaUserRepository implements UserRepository { /* Prisma calls here */ }
```

**Java/Spring:**
```java
// Spring naturally supports DIP via constructor injection of interfaces
@Service
public class OrderService {
    private final OrderRepository orderRepository; // interface, not impl
    private final PaymentGateway paymentGateway;   // interface, not impl

    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }
}
```

**Python:**
```python
# CORRECT: Protocol-based DIP
from typing import Protocol

class UserRepository(Protocol):
    async def find_by_id(self, user_id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...

class UserService:
    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo
```

---

## Detection Checklist for Code Review

Reviewers MUST check each SOLID principle explicitly. Any violation is `must-fix` severity.

| Principle | Red Flags | Auto-Detect |
|-----------|-----------|-------------|
| **SRP** | Class >200 lines, >5 dependencies injected, method does multiple things | Class line count, dependency count |
| **OCP** | switch/if-else on type, modifying existing code for new variants | Pattern match on type-checking conditionals |
| **LSP** | `instanceof` checks, overrides that throw, subtypes with different behavior | Grep for instanceof, NotImplementedError |
| **ISP** | Interface >7 methods, empty/throwing implementations | Interface method count, grep for "not implemented" |
| **DIP** | Direct infrastructure imports in service/domain layer, concrete constructor params | Import analysis per layer |

## Exceptions

SOLID enforcement may be relaxed ONLY when:

1. **Project explicitly declares alternative** in `governance/brain/architecture.md` with `coding_pattern: <alternative>`
2. **Scripting/utility code** under 50 lines total (one-off scripts, not production code)
3. **Performance-critical hot paths** where abstraction overhead is measured and unacceptable (must document with ADR)

All exceptions require an ADR in `governance/brain/adr/` explaining why SOLID was relaxed.
