# Learned Patterns

## Purpose

Accumulated patterns, lessons, and reusable insights extracted from completed
sprints. Each entry captures what was learned, when, and where it applies.
Entries are pruned when contradicted by newer learnings.

## Format

Each pattern follows this structure:

```
### {Pattern Title}
- **Learned**: Sprint {N}
- **Context**: {situation where this was discovered}
- **Pattern**: {the reusable insight}
- **Applies to**: {when to use this pattern}
- **Status**: active | superseded by {other_pattern}
```

## Patterns

<!-- Patterns are appended here as they are discovered during sprint compression.
     Keep entries concise — 3-5 lines each. Remove or mark superseded patterns
     when newer learnings contradict them. Order by recency, newest first. -->

<!-- Example entry (remove when real patterns are added):

### Error Handling Consistency
- **Learned**: Sprint 02
- **Context**: Inconsistent error formats caused frontend parsing failures
- **Pattern**: All API errors must return {code, message, details} shape
- **Applies to**: Any module exposing HTTP endpoints
- **Status**: active

-->

## Maintenance Rules

- Add new patterns during sprint compression (see compression-policy.md)
- Review all patterns during planning phase for applicability
- Mark patterns as superseded rather than deleting them
- If pattern list exceeds 20 active entries, consolidate related patterns
- Patterns older than 5 sprints without reuse are candidates for archival
