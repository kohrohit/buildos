---
description: "Rules governing what enters and exits the staging pipeline"
---

# Staging Policy

## What enters staging
- All log-derived patterns (`source: log_analysis`) go to staging unconditionally
- Patterns must have: description, why, category, source_reference
- Patterns missing `why` are rejected at intake — no naked rules

## What skips staging
- Explicit teaching (`source: explicit`) — saves directly to learned-patterns
- Sprint review patterns (`source: sprint_review`) — inline approval during /build-learn, then direct to learned-patterns

## Staging lifecycle
- Staged patterns have no TTL — they wait indefinitely for review
- `/build-audit staged` presents all staged patterns for approve/reject/edit
- Approved patterns move to `learned-patterns.json` with appropriate TTL
- Rejected patterns are deleted permanently

## Capacity
- No limit on staged patterns (they are pending review, not active knowledge)
- Active pattern limit (50) is enforced at approval time, not staging time
