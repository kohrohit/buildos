# Freshness Policy

## Purpose

Defines how to resolve conflicts between context sources of different ages and
establishes staleness thresholds for all context types. When multiple sources
provide contradictory information, this policy determines which source wins.

## Conflict Resolution Hierarchy

When two sources disagree, the higher-authority source wins:

### Tier 1: Ground Truth (always wins)

| Source | Why It Wins |
|---|---|
| Actual code in the repository | Code is the executed reality |
| Test results (most recent run) | Empirical evidence of behavior |
| Active ADR (status: accepted) | Explicit, deliberate decisions |

### Tier 2: Current State (wins over summaries and history)

| Source | Why It Wins |
|---|---|
| `state/sprint-state.md` | Real-time progress tracking |
| `state/tasks.md` (current sprint) | Authoritative task status |
| `brain/architecture.md` | Maintained, canonical reference |
| `brain/nfrs.md` | Maintained, canonical reference |

### Tier 3: Summaries (wins over raw history)

| Source | Why It Wins |
|---|---|
| Sprint summaries | Curated extractions from raw data |
| Module summaries | Curated module state |
| Project summary | Curated project trajectory |
| Learned patterns | Accumulated, validated insights |

### Tier 4: Historical (lowest authority)

| Source | Why It Wins Nothing |
|---|---|
| Archived sprint raw data | Superseded by summaries |
| Old git log entries | Point-in-time snapshots |
| Superseded ADRs | Replaced by newer decisions |

## Specific Conflict Resolution Rules

### Code vs Documentation
- **Code wins**. If `architecture.md` says the auth module uses sessions but the
  code uses JWT, the code is correct. Flag the documentation as stale.
- **Action**: Update documentation to match code, or file a task to investigate
  if the code diverged incorrectly.

### Recent Sprint State vs Historical Summary
- **Sprint state wins**. If sprint-03 summary says "caching not implemented" but
  sprint state shows a caching task completed, the sprint state is correct.
- **Action**: The summary will be updated at sprint boundary via compression.

### Active ADR vs Superseded ADR
- **Active ADR wins**. If ADR-002 (superseded) chose REST and ADR-007 (accepted)
  chose GraphQL, GraphQL is the current decision.
- **Action**: Never load superseded ADRs without also loading the superseding ADR.

### Architecture vs Sprint Summary References
- **Architecture.md wins**. If a sprint summary references an old component name
  that has since been renamed in architecture.md, use the current name.
- **Action**: Sprint summaries are not retroactively updated; treat them as
  historical records with potentially stale terminology.

### Test Results vs Assumptions
- **Test results win**. If a module summary says "all tests passing" but recent
  test output shows failures, the failures are real.
- **Action**: Update module summary, investigate failures.

## Staleness Thresholds

| Context Type | Fresh | Aging | Stale | Action When Stale |
|---|---|---|---|---|
| Sprint state | Current sprint | N/A | Sprint completed | Compress to summary |
| Sprint summary | 0-2 sprints old | 3-4 sprints | 5+ sprints | Archive into project summary |
| Module summary | Updated within 2 sprints | 3-4 sprints without update | 5+ sprints | Flag for refresh |
| Project summary | Updated within 3 sprints | 4-5 sprints | 6+ sprints | Mandatory refresh |
| Learned patterns | Never auto-stale | N/A | When contradicted | Remove contradicted entries |
| ADRs (accepted) | Always fresh | N/A | When superseded | Mark superseded, load replacement |
| Architecture.md | Updated within 2 sprints | 3 sprints | 4+ sprints | Mandatory review |
| NFRs | Updated within 3 sprints | 4-5 sprints | 6+ sprints | Review for relevance |
| Coding rules | Updated within 5 sprints | 6-8 sprints | 9+ sprints | Review for currency |

## Freshness Signals

How to detect staleness without manual tracking:

1. **File modification timestamp** — compare against sprint dates
2. **Sprint references in content** — if latest sprint reference is old, content is aging
3. **Git blame** — when was the file last meaningfully changed (not just formatting)
4. **Cross-reference check** — does the content reference entities that no longer exist?

## Staleness Response Actions

| Severity | Action |
|---|---|
| Fresh | Load normally |
| Aging | Load with a staleness warning annotation |
| Stale | Warn the agent, recommend refresh, load with caution |
| Critical stale (2x threshold) | Refuse to load, require manual refresh |

## Enforcement

- Every loaded context piece should carry an implicit freshness score
- At sprint boundaries, run a staleness audit across all context files
- Stale context that cannot be refreshed should be excluded rather than loaded
- Log freshness warnings for post-sprint review
- The planning phase should begin with a freshness check of all governance context
