# Loader: Governance Context

## Purpose

Assembles the governance brain for planning, architectural review, and high-level
decision-making phases. Provides the agent with full awareness of project vision,
architectural constraints, non-functional requirements, and active design decisions.

## When to Use

- During `/build:plan` phase
- During `/build:review` and `/build:verify` phases
- When evaluating architectural trade-offs
- When proposing new ADRs or modifying existing ones

## Load Order

Files are loaded in this exact sequence to establish context dependencies correctly:

1. `brain/vision.md` — Project purpose, goals, success criteria
2. `brain/glossary.md` — Shared vocabulary (must precede architecture)
3. `brain/architecture.md` — System architecture, component map, boundaries
4. `brain/nfrs.md` — Non-functional requirements and quality attributes
5. `brain/adrs/` — Active ADRs only (status: accepted or proposed)

## Inclusion Rules

| Source | Condition | Priority |
|---|---|---|
| `brain/vision.md` | Always | Critical |
| `brain/glossary.md` | Always | Critical |
| `brain/architecture.md` | Always | Critical |
| `brain/nfrs.md` | Always | High |
| `brain/adrs/adr-*.md` | Status = accepted OR proposed | High |
| `context/summaries/project-summary.md` | If exists | Medium |

## Exclusion Rules

- ADRs with status `superseded` — load only if the superseding ADR references it
- ADRs with status `rejected` — never load
- Implementation-level details (code, test files, sprint task lists)
- Module internals — use `load-module.md` for those
- Raw sprint data — use `load-sprint.md` for active sprint context
- Any file outside the `brain/` directory unless explicitly listed above

## Token Budget

- Target: ~3000 tokens
- Hard ceiling: 4000 tokens
- If budget exceeded: drop project-summary first, then oldest accepted ADRs

## Freshness Rules

- `architecture.md` is authoritative — if sprint summaries contradict it, architecture wins
- ADRs are immutable once accepted — only superseding creates a new version
- Reload governance context at the start of every planning session
- If `vision.md` changes, invalidate all cached governance context

## Assembly Notes

- Parse ADR frontmatter to filter by status before loading content
- Count active ADRs; if more than 5, load only those referenced by current sprint
- Glossary terms should be available for term resolution in all downstream loaders
