# Planning Context Pack

## Purpose

Assembles context for the `/build:plan` phase. Planning requires the broadest
governance awareness and historical context to produce sprint specs that align
with the project vision, respect architectural constraints, and learn from past
sprint outcomes.

## Phase

`/build:plan` — Sprint planning, goal setting, scope definition

## Included Loaders

| Order | Loader | Mode | Purpose |
|---|---|---|---|
| 1 | `load-governance.md` | Full | Vision, architecture, NFRs, glossary, ADRs |
| 2 | `load-history.md` | Full | Project summary, recent sprint summaries, patterns |
| 3 | `load-rules.md` | Minimal | Global rules only (no language-specific needed) |

## Additional Context

| Source | Condition |
|---|---|
| `state/tasks.md` (previous sprint) | If previous sprint had carryover tasks |
| `brain/roadmap.md` | If exists — long-term feature plan |
| Stakeholder input | If provided as user input to the planning session |

## Excluded Context

- Module internals — planning operates at architecture level, not code level
- Language-specific coding rules — not writing code during planning
- Raw sprint data from completed sprints — use summaries only
- Test files and test results — implementation-level detail
- Git history — too granular for planning scope

## Token Budget

| Layer | Budget | Source |
|---|---|---|
| Governance | 3000 tokens | `load-governance.md` |
| History | 1500 tokens | `load-history.md` |
| Rules (global only) | 500 tokens | `load-rules.md` (global subset) |
| Additional | 500 tokens | Carryover tasks, roadmap |
| **Total** | **5500 tokens** | |
| **Hard ceiling** | **7000 tokens** | |

## Assembly Order

1. Load governance (establishes vocabulary and constraints)
2. Load history (provides trajectory and learnings)
3. Load global rules (sets universal standards)
4. Load additional context (carryover, roadmap)
5. Validate pack completeness against inclusion policy
6. Check freshness of all loaded context

## Expected Outputs

The planning phase, with this context loaded, should produce:

- A sprint spec (`state/current-sprint.md`) with goals and acceptance criteria
- A task list (`state/tasks.md`) with prioritized, scoped tasks
- Any new ADRs needed for architectural decisions in the sprint
- Updated project summary if significant direction changes occurred

## Pre-Assembly Checklist

- [ ] Verify `brain/vision.md` exists and is not stale
- [ ] Verify `brain/architecture.md` exists and is not stale
- [ ] Verify previous sprint was compressed (if applicable)
- [ ] Verify learned patterns are up to date
- [ ] Check for carryover tasks from the previous sprint
