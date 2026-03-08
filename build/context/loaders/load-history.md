# Loader: Historical Context

## Purpose

Assembles compressed historical context to give the agent awareness of project
trajectory, past decisions, and learned patterns without loading raw historical
data that would consume excessive token budget.

## When to Use

- During `/build:plan` to inform new sprint planning with past learnings
- When encountering a problem that may have been solved before
- When onboarding to a project (first session or after long gap)
- During retrospective analysis

## Load Order

1. `context/summaries/project-summary.md` — High-level project state and trajectory
2. `context/summaries/sprint-summaries/` — Last 2 sprint summaries only
3. `context/summaries/learned-patterns-summary.md` — Accumulated patterns and lessons
4. Relevant ADR history — ADRs marked superseded that inform current decisions

## Inclusion Rules

| Source | Condition | Priority |
|---|---|---|
| Project summary | Always | Critical |
| Sprint summaries (last 2) | Always | High |
| Learned patterns | Always | High |
| Sprint summaries (3-5 ago) | Only if explicitly requested | Low |
| Superseded ADRs | Only if current ADR references them | Low |

## Exclusion Rules

- Raw sprint details older than 2 cycles (only summaries survive)
- Superseded ADRs unless directly referenced by an active ADR
- Stale research reports older than 3 sprints
- Intermediate build state from past sprints
- Archived task lists — only outcomes matter
- Full git history — only commit summaries in sprint summaries
- Module internals from past sprints — only pattern extractions

## Token Budget

- Target: ~1500 tokens
- Hard ceiling: 2000 tokens
- If budget exceeded: drop oldest sprint summary first, then trim learned patterns
  to top 10 entries, keep project summary intact

## Freshness Rules

- Project summary is updated at every sprint boundary
- Sprint summaries are immutable once written (they describe a past sprint)
- Learned patterns accumulate — new entries append, old entries are pruned if
  contradicted by newer learnings
- If project summary is older than 3 sprints, flag as stale and recommend refresh
- Sprint summaries older than 5 sprints should be archived into project summary

## Archival Process

When sprint summaries exceed the 2-sprint window:

1. Extract key decisions, outcomes, and patterns from the expiring summary
2. Merge extracted data into `project-summary.md`
3. Move raw summary to `state/archive/sprint-summaries/`
4. Update `learned-patterns-summary.md` with any new patterns

## Assembly Notes

- Sort sprint summaries by recency — newest first
- If no sprint summaries exist yet, load only project summary and patterns
- If no project summary exists, this is a fresh project — return minimal context
- Cross-reference learned patterns with current sprint goals to surface relevant ones
- Tag each loaded piece with its age for freshness-aware downstream processing
