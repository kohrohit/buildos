# Loader: Module Context

## Purpose

Assembles context for a specific module or component. Provides the agent with
focused awareness of a single module's design, API surface, test coverage, and
recent changes without polluting context with unrelated system parts.

## When to Use

- During `/build:execute` when implementing a task scoped to a module
- During `/build:review` when reviewing changes to a specific module
- When resolving cross-module dependencies (load both modules)
- When writing or updating tests for a module

## Parameters

- `module_name` — Required. The module or component identifier (e.g., `auth`, `api-gateway`)
- `depth` — Optional. `shallow` (summary only) or `deep` (full context). Default: `deep`

## Load Order

1. `context/summaries/module-summaries/{module_name}.md` — Module summary
2. `brain/architecture.md` — Extract only the section relevant to this module
3. API contracts — `specs/` or `contracts/` files referencing this module
4. Recent changes — Git log for module path, last 2 sprints only
5. Test context — Test file list and recent test results for this module

## Inclusion Rules

| Source | Condition | Priority |
|---|---|---|
| Module summary | Always | Critical |
| Architecture slice | Always (filtered to module) | High |
| API contracts | If module exposes or consumes APIs | High |
| Test manifest | Always for `deep` depth | Medium |
| Recent git history | Last 2 sprints of commits to module path | Medium |
| Related module summaries | If module has direct dependencies | Low |

## Exclusion Rules

- Other modules' internals — load only their summaries if needed for dependency context
- Git history older than 2 sprint cycles
- Superseded API contract versions
- Build artifacts and generated files
- Full test file contents — load only test names and failure summaries
- Raw sprint details — only sprint summary references to this module

## Token Budget

- Target: ~1500 tokens
- Hard ceiling: 2000 tokens
- Shallow mode ceiling: 800 tokens
- If budget exceeded: drop git history first, then test details, keep summary and
  architecture slice

## Freshness Rules

- Module summary is updated after each sprint that touches the module
- API contracts are authoritative over summary descriptions
- Git history is factual — never contradicted by summaries
- If module summary is older than 2 sprints and module was modified, flag as stale
- Test results from the most recent run override historical pass/fail data

## Assembly Notes

- Use module name to locate files: search `src/{module_name}/`, `modules/{module_name}/`,
  or project-specific path conventions
- For architecture slice: extract headings and content mentioning the module name
- For shallow mode: load only the module summary, skip all other sources
- When loading two modules for cross-module work, use shallow mode for the
  secondary module to stay within budget
