# Loader: Coding Rules Context

## Purpose

Assembles the applicable coding rules based on the detected language, framework,
and project configuration. Ensures the agent operates under the correct coding
standards for every file it touches.

## When to Use

- During `/build:execute` before writing or modifying any code
- During `/build:review` when evaluating code quality
- When generating new files (determines template and style)
- Automatically invoked by `load-sprint.md` and `load-module.md`

## Detection Strategy

1. Check file extension of the target file being worked on
2. Check `state/current-sprint.md` for declared languages/frameworks
3. Check project root for config files: `package.json`, `pyproject.toml`,
   `Cargo.toml`, `go.mod`, `tsconfig.json`, etc.
4. Map detected signals to rule files

## Load Order

1. `rules/global.md` — Always loaded first (universal standards)
2. Language-specific rules — Based on detection (e.g., `rules/typescript.md`)
3. Framework-specific rules — Based on detection (e.g., `rules/react.md`)
4. Project-specific overrides — `rules/project-overrides.md` if it exists

## Detection Mapping

| Signal | Rule File |
|---|---|
| `.ts`, `.tsx`, `tsconfig.json` | `rules/typescript.md` |
| `.py`, `pyproject.toml`, `setup.py` | `rules/python.md` |
| `.rs`, `Cargo.toml` | `rules/rust.md` |
| `.go`, `go.mod` | `rules/go.md` |
| `.js`, `.jsx` | `rules/javascript.md` |
| `package.json` with `react` | `rules/react.md` |
| `next.config.*` | `rules/nextjs.md` |
| `Dockerfile`, `docker-compose.*` | `rules/docker.md` |
| `.md` files | `rules/documentation.md` |

## Inclusion Rules

| Source | Condition | Priority |
|---|---|---|
| `rules/global.md` | Always | Critical |
| Language rules | Detected language match | High |
| Framework rules | Detected framework match | High |
| Project overrides | If file exists | Critical (overrides others) |

## Exclusion Rules

- Rules for languages not present in the current task scope
- Rules for frameworks not detected in the project
- Do not load all rule files speculatively — load only what matches
- If no language is detected, load only global rules

## Token Budget

- Target: ~1000 tokens
- Hard ceiling: 1400 tokens
- If budget exceeded: load global + primary language only, skip framework rules

## Freshness Rules

- Rule files are stable — cache for the entire session
- Project overrides may change between sprints — reload at sprint boundary
- If a rule file is modified mid-sprint, reload on next invocation
- Global rules take precedence unless explicitly overridden by project overrides

## Assembly Notes

- Run detection once per session and cache the result
- If multiple languages are detected, load rules for all (within budget)
- Framework rules supplement language rules — they do not replace them
- Log which rules were loaded for traceability in review phases
