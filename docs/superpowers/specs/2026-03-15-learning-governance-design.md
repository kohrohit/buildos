# Learning Governance System — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Approach:** Hybrid (Approach C) — dedicated log analysis pipeline + extend existing PatternManager

---

## Problem

BuildOS learns patterns via `/build-learn` but has no review gate, no trust hierarchy, no expiry mechanism, and no log ingestion capability. Patterns are saved without user approval and live forever. This is dangerous — the system can learn garbage and reinforce it.

## Solution

A learning governance layer with three controlled input channels, trust-tiered approval gates, TTL-based lifecycle management, and audit tooling.

---

## 1. Trust Pipeline

| Source | Trust | Approval Gate | TTL | Entry Point |
|--------|-------|---------------|-----|-------------|
| Explicit teaching (user says "remember X") | high | None — save immediately | Evergreen | `/build-remember` or agent calls `addPattern()` with `source: explicit` |
| Sprint review (post-verified work) | medium | Inline during `/build-learn` | 90 days | `/build-learn` |
| Log analysis (files or API) | low | Batched via `/build-audit` | 30 days | `/build-ingest` |

Reinforcement resets TTL to the source-based default.

**Explicit teaching entry point:** The LLM agent recognizes user intent ("remember this", "always do X") and calls `addPattern()` with `source: "explicit"`, `trust: "high"`. Alternatively, the user can invoke `/build-remember <description>` directly. No approval gate — the user already approved by stating it.

---

## 2. Data Model

### Extended Pattern Schema (learned-patterns.json)

```json
{
  "id": "pat-003",
  "category": "process|operational|failure|architecture|performance|coding|testing|tooling",
  "description": "Pattern description",
  "why": "Reason this pattern matters — enables edge-case judgment",
  "source": "explicit|sprint_review|log_analysis",
  "trust": "high|medium|low",
  "confidence": 0.6,
  "times_applied": 0,
  "ttl_days": 90,
  "expires_at": "2026-06-13",
  "created_at": "2026-03-15",
  "last_reinforced_at": null,
  "source_reference": "sprint-003|/path/to/log|api-endpoint",
  "status": "active|expired|archived"
}
```

**Confidence initialization by source:**

| Source | Starting confidence |
|--------|-------------------|
| explicit | 0.9 |
| sprint_review | 0.7 |
| log_analysis | 0.5 |

**expires_at computation:**
- Formula: `new Date(Date.now() + ttl_days * 86400000).toISOString()`
- Evergreen patterns (explicit teaching): `expires_at: null`
- `expireSweep()` skips patterns where `expires_at` is null

### New: staging-patterns.json

Same schema. Log-derived patterns land here first. Only move to `learned-patterns.json` after user approval via `/build-audit`.

### Migration Strategy

Existing patterns in `learned-patterns.json` use the old schema (`source_sprint`, no `trust`/`ttl_days`/`status`). On first run after upgrade:

1. Backfill defaults: `source: "sprint_review"`, `trust: "medium"`, `status: "active"`, `ttl_days: 90`, `why: null`, `last_reinforced_at: null`
2. Rename `source_sprint` → `source_reference`
3. Compute `expires_at` from `created_at + ttl_days`
4. Refactor `addPattern()` to accept an options object instead of positional args:
   ```javascript
   // Old: addPattern(category, description, sourceSprintId, confidence)
   // New: addPattern({ category, description, source, trust, why, source_reference, confidence })
   ```
5. Update callers: `add-pattern` CLI command, `/build-learn` flow

### State file registration

Add `staging: 'staging-patterns.json'` to the `STATE_FILES` constant in `build-tools.cjs` so `loadState()` and session-start hooks can access it.

---

## 3. New Commands

### /build-ingest — Log Analysis

**Purpose:** Analyze logs from any source, extract candidate patterns, stage for review.

**Input:** File path (initial scope). API integration is a future extension.

For file input: read the file, any format (JSON, plain text, CSV, metrics, stack traces, anything). The LLM agent handles parsing — no programmatic parser needed.

**Steps:**
1. Read log file from provided path
2. Analyze for meaningful patterns across all categories (operational, failure, architecture, performance, process)
3. Deduplicate against existing patterns — the LLM agent compares candidate patterns against existing patterns semantically. If the agent determines >80% semantic overlap, it reinforces the existing pattern instead of creating a new one
4. Write candidates to `staging-patterns.json` with `source: log_analysis`, `trust: low`, `confidence: 0.5`
5. Report: "Extracted N candidates. Run `/build-audit` to review."

### /build-audit — Review & Lifecycle

**Invocation:** `/build-audit [mode]`
- `/build-audit staged` — review staged patterns only
- `/build-audit expiring` — review expiring patterns only
- `/build-audit` (no arg) — full audit (default)

**Review staged:**
- Show pending candidates from `staging-patterns.json`
- For each: approve (moves to learned-patterns) / reject (deletes) / edit (modify then approve)

**Review expiring:**
- Show patterns with `expires_at` within 14 days
- For each: renew (resets TTL) / archive / delete

**Full audit:**
- Both of the above
- Plus confidence distribution, trust breakdown, health stats

**Undo:** There is no dedicated undo for approvals. Approved patterns can be removed via `/build-audit` full audit (delete action).

### /build-remember — Explicit Teaching

**Purpose:** Quick entry point for explicit teaching without going through `/build-learn`.

**Invocation:** `/build-remember` — the LLM agent captures the pattern from conversation context.

**Behavior:** Calls `addPattern()` with `source: "explicit"`, `trust: "high"`, `ttl_days: 0` (evergreen), `confidence: 0.9`. No approval gate.

---

## 4. Modifications to Existing Components

### PatternManager (build-tools.cjs)

**Refactored methods:**
- `addPattern(opts)` — accepts options object: `{ category, description, source, trust, ttl_days, why, source_reference, confidence }`. Computes `expires_at` (null if `ttl_days === 0`). **Enforces 50-pattern cap** — if at capacity, blocks addition with message: "At 50-pattern limit. Run /build-audit to prune." Returns false.
- `reinforcePattern(id)` — also resets `expires_at` based on `ttl_days`, updates `last_reinforced_at`

**New methods:**
- `getExpiring(withinDays)` — returns patterns expiring within N days
- `getStaged()` — reads `staging-patterns.json`
- `approveStaged(id)` — enforces 50-pattern cap, then moves from staging to learned-patterns
- `rejectStaged(id)` — deletes from staging
- `expireSweep()` — marks past-due patterns as `status: expired` (skips `expires_at: null`)
- `migrate()` — one-time migration from old schema to new (see Migration Strategy)

### /build-learn (existing command)

After pattern extraction (step 5), add inline approval gate:
- Show each extracted pattern: description + why + category
- User approves / rejects / edits each
- Only approved patterns reach `learned-patterns.json`

### /build-status (existing command)

New "Learning Health" section:
```
Learning Health
├─ Active patterns: 14 (5 high, 6 medium, 3 low trust)
├─ Staged (pending review): 3
├─ Expiring within 14 days: 2
└─ Archived: 7
```

### Session-start hook

- Run `expireSweep()` to mark expired patterns
- Read `staging-patterns.json` (via STATE_FILES registration)
- Check for pending staged patterns and expiring patterns
- Nudge: "N patterns pending review, M expiring soon. Run /build-audit when ready."

---

## 5. File Structure

```
build/
├── learning/                    # NEW — dedicated subsystem
│   ├── analyzer.md              # Log analysis instructions (format-agnostic)
│   ├── staging-policy.md        # Rules for what enters staging
│   └── lifecycle-policy.md      # TTL rules, expiry, reinforcement
├── commands/
│   ├── build-ingest.md          # NEW
│   ├── build-audit.md           # NEW
│   ├── build-remember.md        # NEW
│   ├── build-learn.md           # MODIFIED — add inline approval gate
│   └── build-status.md          # MODIFIED — add learning health
├── state/
│   ├── learned-patterns.json    # MODIFIED — extended schema
│   └── staging-patterns.json    # NEW
└── bin/
    └── build-tools.cjs          # MODIFIED — PatternManager extensions, migration, STATE_FILES
```

---

## 6. Governance Rules for Learning

1. Patterns must not contradict existing governance rules
2. Patterns must include `why` — no naked rules without reasoning
3. No secrets, credentials, or PII in pattern descriptions
4. Duplicate detection: LLM agent compares candidates semantically against existing patterns. >80% overlap → reinforce instead of create new
5. Maximum 50 active patterns — enforced in `addPattern()` and `approveStaged()`. At capacity: block and prompt user to prune via `/build-audit`
6. Approved patterns can be deleted via `/build-audit` but there is no single-action undo

---

## 7. Summary

The system creates three controlled channels for learning (explicit, sprint, logs) with trust-tiered approval gates that match friction to risk. Patterns have source-based TTLs so stale knowledge surfaces for review rather than silently persisting. `/build-audit` gives the user full control to approve, renew, or kill patterns. The session-start nudge ensures nothing rots unnoticed.
