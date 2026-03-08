# Base Context Pack Template

## Purpose

Defines the standard structure for all context packs. Every phase-specific pack
inherits this structure and customizes it. A context pack is the assembled bundle
of context that gets loaded before the agent begins work on a phase.

## Pack Structure

```
Context Pack: {pack_name}
Phase: {phase_identifier}
Token Budget: {total_budget}
Assembled: {timestamp}
```

## Assembly Order

Context is assembled in this order to ensure dependencies are resolved:

1. **Foundation Layer** — Governance context (vision, architecture, glossary)
2. **State Layer** — Current sprint and task state
3. **Scope Layer** — Module-specific or task-specific context
4. **Rules Layer** — Coding standards and constraints
5. **History Layer** — Compressed historical context and patterns

Each layer builds on the previous. The foundation layer establishes vocabulary
and boundaries. The state layer grounds the agent in current work. The scope
layer focuses on what is being touched. Rules constrain how work is done.
History provides learnings from past work.

## Token Budget Allocation

| Layer | Default Allocation | Flexible |
|---|---|---|
| Foundation | 30% of total budget | No — always fully loaded |
| State | 25% of total budget | Partially — can summarize completed tasks |
| Scope | 25% of total budget | Yes — depth adjustable |
| Rules | 10% of total budget | Yes — only relevant rules loaded |
| History | 10% of total budget | Yes — can be dropped entirely |

## Pack Metadata

Every assembled pack includes metadata for traceability:

- `pack_type`: Which template was used
- `assembled_at`: Timestamp of assembly
- `sprint`: Current sprint identifier
- `token_count`: Actual token count after assembly
- `loaders_used`: List of loaders invoked
- `exclusions_applied`: List of exclusion rules that triggered
- `freshness_warnings`: Any staleness warnings detected
- `budget_overflows`: Whether any layer exceeded its allocation

## Validation Rules

Before a pack is used, validate:

1. All Critical-priority context from the inclusion policy is present
2. No excluded content (per exclusion policy) slipped through
3. Total token count is within the hard ceiling
4. No freshness warnings at Critical stale level
5. Assembly order was respected (foundation before state before scope)

## Error Handling

| Error | Response |
|---|---|
| Missing critical context file | Halt assembly, report missing file |
| Token budget exceeded | Apply compression, drop lowest-priority layers |
| Stale critical context | Warn agent, proceed with caution flag |
| Conflicting context detected | Apply freshness policy resolution |
| Loader failure | Skip failed loader, log error, proceed with partial pack |
