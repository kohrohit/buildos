---
description: "TTL rules, expiry behavior, and reinforcement mechanics"
---

# Pattern Lifecycle Policy

## TTL by source

| Source | TTL | Reinforcement resets TTL |
|--------|-----|--------------------------|
| explicit | Evergreen (ttl_days: 0, expires_at: null) | N/A |
| sprint_review | 90 days | Yes, back to 90 days |
| log_analysis | 30 days | Yes, back to 30 days |

## Expiry behavior
- `expireSweep()` runs at session start
- Patterns past `expires_at` get `status: expired`
- Expired patterns are NOT deleted — they surface in `/build-audit expiring` for review
- User can: renew (resets TTL), archive (`status: archived`), or delete

## Reinforcement
- When a pattern is applied or referenced, call `reinforcePattern(id)`
- This increments `times_applied`, adds +0.05 to confidence (max 1.0), resets `expires_at`, and updates `last_reinforced_at`

## Confidence initialization

| Source | Starting confidence |
|--------|-------------------|
| explicit | 0.9 |
| sprint_review | 0.7 |
| log_analysis | 0.5 |

## Capacity
- Maximum 50 active patterns enforced in `addPattern()` and `approveStaged()`
- At capacity: block with message "At 50-pattern limit. Run /build-audit to prune."

## expires_at computation
- Formula: `new Date(Date.now() + ttl_days * 86400000).toISOString()`
- Evergreen patterns: `expires_at: null`
- `expireSweep()` skips patterns where `expires_at` is null
