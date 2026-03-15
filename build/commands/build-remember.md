---
description: "Quick entry point for explicit teaching — save high-trust evergreen patterns"
---

# /build-remember — Explicit Teaching

## Purpose
Capture a pattern directly from user instruction. Highest trust level, no approval gate, evergreen TTL. Use when the user says "remember this", "always do X", or explicitly teaches a rule.

## Context Pack
Load: `state/learned-patterns.json` (to check for duplicates and capacity)

## Steps

1. **Capture pattern from conversation context**
   - Extract: description (what to remember) and why (reason given by user)
   - If user didn't provide a why, ask for one — no naked rules

2. **Deduplicate**
   - Compare semantically against existing patterns
   - If >80% overlap, reinforce existing pattern instead

3. **Save directly**
   - Call `PatternManager.addPattern()` with:
     - `source: "explicit"`
     - `trust: "high"`
     - `ttl_days: 0` (evergreen)
     - `confidence: 0.9`
   - No approval gate — user already approved by stating the instruction

4. **Confirm**
   - Show saved pattern to user for verification

## Governance Checks
- Pattern must include `why`
- No secrets, credentials, or PII
- Must not contradict governance rules
- 50-pattern cap enforced

## State Updates
- `learned-patterns.json`: new pattern added

## Output
```
Pattern Saved (explicit / high trust / evergreen)
  [{category}] {description}
  Why: {why}
  ID: {pattern_id}
```
