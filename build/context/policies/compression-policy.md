# Compression Policy

## Purpose

Defines when and how to compress context to keep the project's knowledge base
within token budgets while preserving essential information. Compression is not
deletion — it is structured summarization that retains decisions, outcomes, and
patterns while discarding intermediate process details.

## Compression Triggers

### After Sprint Completion

**Trigger**: Sprint status changes to `completed` in sprint state.
**Action**: Compress full sprint details into a sprint summary.

**Keep**: Sprint goals and outcomes, key decisions with rationale, deliverables
produced, issues and their resolutions, learned patterns, metrics (tasks
completed vs planned, blockers encountered).

**Drop**: Step-by-step implementation instructions, intermediate task state
transitions, work-in-progress notes, verbose blocker descriptions (keep
resolution only), daily progress updates.

### After Module Milestone

**Trigger**: Module reaches a defined milestone (initial implementation, major refactor).
**Action**: Update or create the module summary.

**Keep**: Module purpose, boundaries, public API, key design decisions and
constraints, dependencies, test coverage status, recent change summary.

**Drop**: Line-by-line change descriptions, intermediate refactoring steps,
debug session notes, experimental approaches that were abandoned.

### After 3 Sprint Cycles

**Trigger**: A sprint summary is 3 or more sprints old.
**Action**: Archive the sprint summary into the project summary.

**Keep** (merged into project summary): Major milestones achieved, architectural
decisions still active, patterns still applicable.

**Drop**: Sprint-specific scope and task details, resolved blockers, sprint metrics.

## Sprint Summary Template

```markdown
# Sprint {number} Summary
## Period
{start_date} — {end_date}
## Goals and Outcomes
| Goal | Status | Notes |
|---|---|---|
| {goal} | Met / Partially Met / Not Met | {brief_note} |
## Key Decisions
- {decision}: {rationale} (see ADR-{N} if applicable)
## Deliverables
- {module/feature}: {one-line description}
## Issues and Resolutions
- {issue}: {resolution}
## Patterns Learned
- {pattern}: {context and applicability}
## Metrics
- Tasks: {completed}/{planned} | Blockers: {count} ({resolved} resolved)
```

## Module Summary Template

```markdown
# Module: {name}
## Purpose
{one-paragraph description}
## Boundaries
- Owns: {responsibilities} | Delegates: {dependencies}
## Public API
- {endpoint/function}: {brief description}
## Key Design Decisions
- {decision}: {rationale}
## Dependencies
- Upstream: {list} | Downstream: {list}
## Current State
- Status: {active / stable / deprecated}
- Test coverage: {summary} | Known limitations: {list}
- Last updated: Sprint {N}
```

## Project Summary Archive Entry Template

```markdown
## Sprint {N} Archive
- Milestone: {what was achieved}
- Decisions: {decisions still in effect}
- Patterns: {patterns added to learned-patterns-summary}
```

## Compression Quality Rules

1. Preserve the "why" — rationale for decisions always survives compression
2. Outcomes over process — keep results, drop steps
3. Patterns are highest-value — always capture reusable learnings
4. Numbers matter — keep metrics, drop narrative effort descriptions
5. Links survive — reference ADRs by number, modules by name
6. Compression is lossy by design — optimize for signal density over completeness

## Enforcement

- Compression happens at sprint boundaries, not mid-sprint
- The agent performing compression must verify the summary against the raw data
- After compression, the raw data moves to `state/archive/` (not deleted)
- Summaries are reviewed during the next planning phase for accuracy
- If a summary is missing critical information, restore from archive and re-compress
