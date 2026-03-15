---
description: "Review staged patterns, manage expiring patterns, audit learning health"
---

# /build-audit — Learning Audit & Review

## Purpose
Review and approve staged pattern candidates, manage expiring patterns, and view learning health metrics. This is the primary governance gate for the learning system.

## Context Pack
Load: `learning/lifecycle-policy.md`, `learning/staging-policy.md`
Also load: `state/learned-patterns.json`, `state/staging-patterns.json`

## Invocation
- `/build-audit` — full audit (default)
- `/build-audit staged` — review staged patterns only
- `/build-audit expiring` — review expiring patterns only

## Steps

### Mode: staged
1. Load `staging-patterns.json`
2. If empty, report "No staged patterns pending review"
3. For each staged pattern, present:
   - Category, description, why, source_reference, confidence
4. For each, ask user: **approve** / **reject** / **edit**
   - Approve: call `PatternManager.approveStaged(id)` — moves to learned-patterns
   - Reject: call `PatternManager.rejectStaged(id)` — deletes from staging
   - Edit: let user modify description/why/category, then approve

### Mode: expiring
1. Call `PatternManager.getExpiring(14)` for patterns expiring within 14 days
2. Also show patterns with `status: expired`
3. For each, present: description, why, trust, confidence, times_applied, expires_at
4. For each, ask user: **renew** / **archive** / **delete**
   - Renew: call `PatternManager.reinforcePattern(id)` — resets TTL
   - Archive: set `status: archived`
   - Delete: remove from patterns array

### Mode: full (default)
1. Run staged review
2. Run expiring review
3. Show learning health dashboard

## Governance Checks
- Approved patterns must not contradict governance rules
- Approved patterns must include `why`
- 50-pattern cap enforced at approval time

## State Updates
- `staging-patterns.json`: candidates removed (approved or rejected)
- `learned-patterns.json`: approved patterns added, expired patterns updated

## Output (full audit)
```
Learning Audit
==============

Staged Patterns: {n} pending
  {review results}

Expiring Patterns: {n} within 14 days
  {review results}

Learning Health
├─ Active patterns: {n} ({high} high, {med} medium, {low} low trust)
├─ Staged (pending review): {n}
├─ Expiring within 14 days: {n}
├─ Expired: {n}
└─ Archived: {n}
```
