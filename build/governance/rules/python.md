# Python / FastAPI / Django Standards

Language-specific engineering standards for Python projects using FastAPI or Django.

## Design Standards

### Project Structure (FastAPI)
```
project/
  ├── app/
  │   ├── api/
  │   │   ├── v1/
  │   │   │   ├── endpoints/     # Route handlers
  │   │   │   └── dependencies.py # Dependency injection
  │   │   └── middleware.py
  │   ├── core/
  │   │   ├── config.py          # Settings via pydantic-settings
  │   │   ├── security.py        # Auth utilities
  │   │   └── exceptions.py      # Custom exceptions
  │   ├── models/                # SQLAlchemy/ORM models
  │   ├── schemas/               # Pydantic schemas (request/response)
  │   ├── services/              # Business logic
  │   ├── repositories/          # Data access layer
  │   └── utils/                 # Utility functions
  ├── tests/
  ├── alembic/                   # Database migrations
  ├── pyproject.toml
  └── Dockerfile
```

### Project Structure (Django)
```
project/
  ├── config/                    # Project settings, URLs, WSGI/ASGI
  ├── apps/
  │   └── <app_name>/
  │       ├── models.py
  │       ├── views.py or api/
  │       ├── serializers.py     # DRF serializers
  │       ├── services.py        # Business logic (not in views)
  │       ├── selectors.py       # Query logic (not in views)
  │       ├── tests/
  │       └── urls.py
  ├── common/                    # Shared utilities
  ├── manage.py
  └── pyproject.toml
```

### Architecture Rules
- Views/endpoints handle HTTP concerns only; delegate to services
- Services contain business logic; they accept and return domain objects, not HTTP types
- Repositories/selectors encapsulate database queries
- Pydantic schemas or DRF serializers handle validation at API boundaries
- Use dependency injection (FastAPI Depends, or manual injection for Django)

## Naming Conventions

### General Python
- Modules and packages: `snake_case` (`user_service.py`, `order_repository.py`)
- Classes: `PascalCase` (`UserService`, `OrderRepository`)
- Functions and variables: `snake_case` (`create_user`, `order_total`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`)
- Private members: single underscore prefix (`_validate_input`)
- Type aliases: `PascalCase` (`UserId = int`, `OrderItems = list[OrderItem]`)

### FastAPI Specific
- Route handlers: verb-based (`get_user`, `create_order`, `update_status`)
- Schema classes: action-based (`CreateUserRequest`, `UserResponse`, `UpdateOrderPayload`)
- Dependency functions: descriptive (`get_current_user`, `get_db_session`)
- Router variables: resource-based (`user_router`, `order_router`)

### Django Specific
- Views: action-based (`UserListView`, `OrderDetailView`)
- Serializers: model-based (`UserSerializer`, `OrderCreateSerializer`)
- Services: domain-verb (`create_user`, `process_order`)
- Selectors: query-based (`get_user_by_email`, `list_active_orders`)

## Test Expectations

### Testing Framework
- Use `pytest` as the primary test runner (not unittest)
- Use `pytest-asyncio` for async test functions
- Use `factory_boy` for test data factories
- Use `httpx.AsyncClient` for FastAPI integration tests
- Use `pytest-django` and DRF's `APIClient` for Django tests

### Test Organization
```python
# tests/test_user_service.py

class TestCreateUser:
    """Tests for UserService.create_user"""

    async def test_creates_user_with_valid_data(self, db_session):
        # Arrange
        user_data = CreateUserRequest(name="Alice", email="alice@example.com")

        # Act
        user = await user_service.create_user(user_data)

        # Assert
        assert user.name == "Alice"
        assert user.email == "alice@example.com"

    async def test_raises_error_for_duplicate_email(self, db_session, existing_user):
        user_data = CreateUserRequest(name="Bob", email=existing_user.email)

        with pytest.raises(DuplicateEmailError):
            await user_service.create_user(user_data)
```

### Coverage
- Use `pytest-cov` for coverage reporting
- Configure in `pyproject.toml` under `[tool.pytest.ini_options]`
- Exclude migrations, config, and test files from coverage

## Security Constraints

### Input Validation
- Use Pydantic models with strict validation for all API inputs
- Use `Field(...)` with constraints: `Field(min_length=1, max_length=255)`
- Validate email, URL, and other formats using Pydantic types
- Never use `eval()`, `exec()`, or `pickle.loads()` on user input
- Use parameterized queries for all database operations

### Authentication
- Use `python-jose` or `PyJWT` for JWT handling
- Store password hashes with `passlib` using bcrypt
- Implement token refresh with short-lived access tokens (15 min) and longer refresh tokens (7 days)
- Use FastAPI `Depends` chain for authentication middleware

### Secrets
- Use `pydantic-settings` to load configuration from environment variables
- Never import secrets directly; inject via configuration
- Use `.env` files only for local development (never commit)
- Validate all required settings at startup (fail fast)

## Performance Expectations

### Async Best Practices
- Use `async def` for all I/O-bound route handlers in FastAPI
- Use `asyncpg` or async SQLAlchemy for database access
- Use `httpx.AsyncClient` for outbound HTTP calls
- Never call synchronous blocking functions in async handlers without `run_in_executor`
- Use connection pooling for database and HTTP clients

### Database
- Use Alembic for migrations (FastAPI) or Django migrations
- Always create indexes for foreign keys and frequently queried columns
- Use `select_related` / `prefetch_related` in Django to avoid N+1
- Use SQLAlchemy `joinedload` / `selectinload` for eager loading
- Implement cursor-based pagination for large datasets

### Caching
- Use `redis` or `aioredis` for caching
- Cache expensive computations and frequently accessed data
- Set explicit TTLs on all cache entries
- Invalidate cache on write operations

## Anti-Patterns

### Python Anti-Patterns
- **Mutable default arguments**: `def func(items=[])` -- use `None` and initialize inside
- **Bare except**: `except:` -- always catch specific exceptions
- **Star imports**: `from module import *` -- import explicitly
- **Global state**: Mutable module-level variables -- use dependency injection
- **Type ignore abuse**: Excessive `# type: ignore` comments -- fix the types
- **Nested comprehensions**: More than 2 levels -- use explicit loops

### Framework Anti-Patterns
- Business logic in route handlers or views (move to services)
- Raw SQL without parameterization
- Synchronous database calls in async handlers
- Missing request validation (trusting client input)
- Returning ORM models directly as responses (use schemas/serializers)
- Fat models in Django (move logic to services/selectors)

## Review Checklist

- [ ] Type hints on all function signatures and return types
- [ ] Pydantic models validate all API inputs
- [ ] Async/await used correctly (no sync blocking in async context)
- [ ] Database queries are optimized (no N+1, proper indexes)
- [ ] Tests use pytest with clear arrange/act/assert structure
- [ ] Error handling returns appropriate HTTP status codes
- [ ] Configuration loaded from environment (no hardcoded values)
- [ ] Logging uses structured format with `structlog` or `logging`
- [ ] Dependencies are pinned in `pyproject.toml` or `requirements.txt`
- [ ] Code passes `ruff` linting and `mypy` type checking
- [ ] Migrations are reversible and tested
- [ ] API documentation is auto-generated and accurate (FastAPI /docs)
