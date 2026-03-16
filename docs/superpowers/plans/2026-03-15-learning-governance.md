# Learning Governance System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trust-tiered learning governance to BuildOS so patterns are only learned through controlled channels with user approval, TTL-based expiry, and audit tooling.

**Architecture:** Extend existing PatternManager in `build-tools.cjs` with trust/TTL/staging fields. Add new `build/learning/` directory for log analysis and lifecycle policies. Add three new commands (`/build-ingest`, `/build-audit`, `/build-remember`) as markdown specs + CLI handlers.

**Tech Stack:** Node.js (build-tools.cjs), Markdown command specs, JSON state files.

**Spec:** `docs/superpowers/specs/2026-03-15-learning-governance-design.md`

---

## Chunk 1: Data Model & Migration

### Task 1: Create staging-patterns.json state file

**Files:**
- Create: `build/state/staging-patterns.json`

- [ ] **Step 1: Create the staging state file**

```json
{
  "patterns": [],
  "last_updated": null
}
```

- [ ] **Step 2: Verify file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('build/state/staging-patterns.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add build/state/staging-patterns.json
git commit -m "feat(learning): add staging-patterns.json state file"
```

---

### Task 2: Register staging in STATE_FILES and add migration

**Files:**
- Modify: `build/bin/build-tools.cjs` — `STATE_FILES` constant (search for `const STATE_FILES`)
- Modify: `build/bin/build-tools.cjs` — `PatternManager` object (search for `const PatternManager`)
- Modify: `build/bin/build-tools.cjs` — `StateManager.resetAll()` method (search for `resetAll`)

- [ ] **Step 1: Add staging to STATE_FILES**

In `build-tools.cjs`, add `staging` to the `STATE_FILES` constant (line 18-25):

```javascript
const STATE_FILES = {
  project: 'current-project.json',
  roadmap: 'roadmap.json',
  sprint: 'sprint-state.json',
  task: 'task-state.json',
  context: 'context-state.json',
  patterns: 'learned-patterns.json',
  staging: 'staging-patterns.json',
};
```

- [ ] **Step 2: Add migrate() method to PatternManager**

Add after `getHighConfidence()` method (after line 706):

```javascript
  migrate() {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns || patterns.patterns.length === 0) return;
    let migrated = false;
    for (const pat of patterns.patterns) {
      if (!pat.source) {
        pat.source = 'sprint_review';
        pat.trust = 'medium';
        pat.status = 'active';
        pat.ttl_days = 90;
        pat.why = pat.why || null;
        pat.last_reinforced_at = pat.last_reinforced_at || null;
        pat.source_reference = pat.source_sprint || null;
        pat.expires_at = pat.created_at
          ? new Date(new Date(pat.created_at).getTime() + 90 * 86400000).toISOString()
          : null;
        delete pat.source_sprint;
        migrated = true;
      }
    }
    if (migrated) {
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return migrated;
  },
```

- [ ] **Step 3: Update StateManager.resetAll() to create staging state**

Find `resetAll()` in `StateManager`. Add `saveState('staging', { patterns: [], last_updated: null });` alongside the other state file initializations. Also update the init command output string from `'All 6 state files created'` to `'All 7 state files created'` (search for `All 6 state files`).

- [ ] **Step 4: Test status still works**

Run: `node build/bin/build-tools.cjs status`
Expected: Status output without errors

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(learning): register staging state file and add pattern migration"
```

---

### Task 3: Refactor addPattern() to options object

**Files:**
- Modify: `build/bin/build-tools.cjs` — `PatternManager.addPattern()` method (search for `addPattern(category`)
- Modify: `build/bin/build-tools.cjs` — `add-pattern` CLI command handler (search for `'add-pattern'`)

- [ ] **Step 1: Refactor addPattern to accept options object**

Replace the existing `addPattern(category, description, sourceSprintId, confidence)` method in `PatternManager`:

```javascript
  addPattern(opts) {
    const patterns = loadState('patterns') || { patterns: [], last_updated: null };

    // Enforce 50-pattern cap
    const activeCount = patterns.patterns.filter(p => p.status === 'active').length;
    if (activeCount >= 50) {
      return { error: 'At 50-pattern limit. Run /build-audit to prune.' };
    }

    const source = opts.source || 'sprint_review';
    const trustMap = { explicit: 'high', sprint_review: 'medium', log_analysis: 'low' };
    const ttlMap = { explicit: 0, sprint_review: 90, log_analysis: 30 };
    const confMap = { explicit: 0.9, sprint_review: 0.7, log_analysis: 0.5 };

    const trust = opts.trust || trustMap[source] || 'medium';
    const ttlDays = opts.ttl_days != null ? opts.ttl_days : (ttlMap[source] || 90);
    const confidence = opts.confidence != null ? opts.confidence : (confMap[source] || 0.7);

    const pattern = {
      id: genId('pat'),
      category: opts.category || 'general',
      description: opts.description || '',
      why: opts.why || null,
      source: source,
      trust: trust,
      confidence: confidence,
      times_applied: 0,
      ttl_days: ttlDays,
      expires_at: ttlDays === 0 ? null : new Date(Date.now() + ttlDays * 86400000).toISOString(),
      created_at: now(),
      last_reinforced_at: null,
      source_reference: opts.source_reference || null,
      status: 'active',
    };
    patterns.patterns.push(pattern);
    patterns.last_updated = now();
    saveState('patterns', patterns);
    return pattern;
  },
```

- [ ] **Step 2: Update add-pattern CLI command caller**

Replace the `'add-pattern'` command handler in the `Commands` object:

```javascript
  'add-pattern': function(args) {
    const category = args[0] || 'general';
    const description = args[1] || '';
    const sprint = loadState('sprint');
    const sprintId = sprint ? sprint.sprint_id : null;
    const pat = PatternManager.addPattern({
      category,
      description,
      source: 'sprint_review',
      source_reference: sprintId,
    });
    if (pat.error) {
      console.error(pat.error);
      process.exit(1);
    }
    console.log(`Pattern recorded: ${pat.id} — [${category}] ${description}`);
  },
```

- [ ] **Step 3: Test add-pattern still works**

Run: `node build/bin/build-tools.cjs add-pattern testing "test pattern from migration"`
Expected: `Pattern recorded: pat-XXX — [testing] test pattern from migration`

- [ ] **Step 4: Verify pattern has new schema fields**

Run: `node -e "const p = JSON.parse(require('fs').readFileSync('build/state/learned-patterns.json','utf8')); console.log(JSON.stringify(p.patterns[p.patterns.length-1], null, 2))"`
Expected: Pattern object with `source`, `trust`, `ttl_days`, `expires_at`, `status` fields

- [ ] **Step 5: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "refactor(learning): addPattern accepts options object with trust/TTL fields"
```

---

### Task 4: Extend reinforcePattern() with TTL reset and add new query methods

**Files:**
- Modify: `build/bin/build-tools.cjs` — `PatternManager.reinforcePattern()` method (search for `reinforcePattern(patternId)`)
- Modify: `build/bin/build-tools.cjs` — add new methods to `PatternManager` after `migrate()`

- [ ] **Step 1: Update reinforcePattern to reset TTL**

Replace the existing `reinforcePattern(patternId)` method in `PatternManager`:

```javascript
  reinforcePattern(patternId) {
    const patterns = loadState('patterns');
    if (!patterns) return null;
    const pat = patterns.patterns.find(p => p.id === patternId);
    if (pat) {
      pat.times_applied += 1;
      pat.confidence = Math.min(1.0, pat.confidence + 0.05);
      pat.last_reinforced_at = now();
      if (pat.ttl_days && pat.ttl_days > 0) {
        pat.expires_at = new Date(Date.now() + pat.ttl_days * 86400000).toISOString();
      }
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return pat;
  },
```

- [ ] **Step 2: Add getExpiring, staging, and lifecycle methods**

Add after the `migrate()` method:

```javascript
  getExpiring(withinDays) {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return [];
    const horizon = new Date(Date.now() + (withinDays || 14) * 86400000).toISOString();
    return patterns.patterns.filter(p =>
      p.status === 'active' && p.expires_at && p.expires_at <= horizon
    );
  },

  expireSweep() {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return 0;
    const today = now();
    let expired = 0;
    for (const pat of patterns.patterns) {
      if (pat.status === 'active' && pat.expires_at && pat.expires_at <= today) {
        pat.status = 'expired';
        expired++;
      }
    }
    if (expired > 0) {
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return expired;
  },

  getStaged() {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    return staging.patterns;
  },

  addStaged(opts) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const confMap = { explicit: 0.9, sprint_review: 0.7, log_analysis: 0.5 };
    const pattern = {
      id: genId('stg'),
      category: opts.category || 'general',
      description: opts.description || '',
      why: opts.why || null,
      source: opts.source || 'log_analysis',
      trust: opts.trust || 'low',
      confidence: opts.confidence != null ? opts.confidence : (confMap[opts.source] || 0.5),
      times_applied: 0,
      ttl_days: opts.ttl_days != null ? opts.ttl_days : 30,
      created_at: now(),
      last_reinforced_at: null,
      source_reference: opts.source_reference || null,
      expires_at: null,
      status: 'staged',
    };
    staging.patterns.push(pattern);
    staging.last_updated = now();
    saveState('staging', staging);
    return pattern;
  },

  approveStaged(patternId) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const idx = staging.patterns.findIndex(p => p.id === patternId);
    if (idx === -1) return null;

    const pat = staging.patterns[idx];
    staging.patterns.splice(idx, 1);
    staging.last_updated = now();
    saveState('staging', staging);

    // Move to learned patterns via addPattern
    return PatternManager.addPattern({
      category: pat.category,
      description: pat.description,
      why: pat.why,
      source: pat.source,
      trust: pat.trust,
      confidence: pat.confidence,
      ttl_days: pat.ttl_days,
      source_reference: pat.source_reference,
    });
  },

  rejectStaged(patternId) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const idx = staging.patterns.findIndex(p => p.id === patternId);
    if (idx === -1) return false;
    staging.patterns.splice(idx, 1);
    staging.last_updated = now();
    saveState('staging', staging);
    return true;
  },

  getLearningHealth() {
    const patterns = loadState('patterns') || { patterns: [] };
    const staging = loadState('staging') || { patterns: [] };
    const active = patterns.patterns.filter(p => p.status === 'active');
    const expiring = PatternManager.getExpiring(14);
    return {
      active: active.length,
      high_trust: active.filter(p => p.trust === 'high').length,
      medium_trust: active.filter(p => p.trust === 'medium').length,
      low_trust: active.filter(p => p.trust === 'low').length,
      staged: staging.patterns.length,
      expiring: expiring.length,
      expired: patterns.patterns.filter(p => p.status === 'expired').length,
      archived: patterns.patterns.filter(p => p.status === 'archived').length,
    };
  },
```

- [ ] **Step 3: Test expireSweep on empty state**

Run: `node build/bin/build-tools.cjs status`
Expected: Status output, no errors

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(learning): add TTL reset, expiry sweep, staging ops, and health metrics"
```

---

## Chunk 2: Learning Policy Files

### Task 5: Create learning subsystem policy files

**Files:**
- Create: `build/learning/analyzer.md`
- Create: `build/learning/staging-policy.md`
- Create: `build/learning/lifecycle-policy.md`

- [ ] **Step 1: Create build/learning/ directory**

Run: `mkdir -p build/learning`

- [ ] **Step 2: Create analyzer.md**

```markdown
---
description: "Format-agnostic log analysis instructions for pattern extraction"
---

# Log Analyzer

## Purpose
Analyze log data from any source and format to extract candidate patterns for the learning governance system.

## Input Handling
The analyzer accepts any format: JSON, plain text, CSV, metrics dumps, stack traces, API responses, structured or unstructured. No programmatic parser — the LLM agent interprets the content semantically.

## Extraction Categories
Extract patterns across all categories:
- **operational** — runtime behavior, throughput, resource usage baselines
- **failure** — error signatures, root cause correlations, timeout patterns
- **architecture** — service dependencies, data flow observations, coupling signals
- **performance** — latency baselines, degradation thresholds, capacity limits
- **process** — workflow patterns, bottleneck indicators, deployment observations

## Extraction Rules
1. Each candidate pattern MUST include a `why` — the evidence from the logs that supports it
2. Set `source_reference` to the file path or API endpoint analyzed
3. Deduplicate: compare each candidate semantically against existing patterns in `learned-patterns.json`. If >80% overlap, reinforce the existing pattern instead of creating a new candidate
4. Assign `category` based on the nature of the observation
5. Do not extract patterns from insufficient evidence (single log line with no context)
6. Do not include secrets, tokens, passwords, or PII in pattern descriptions
7. Prefer specific, actionable observations over vague generalizations

## Output
Write candidates to `staging-patterns.json` via `PatternManager.addStaged()`. Report count to user with instruction to run `/build-audit` for review.
```

- [ ] **Step 3: Create staging-policy.md**

```markdown
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
```

- [ ] **Step 4: Create lifecycle-policy.md**

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add build/learning/
git commit -m "feat(learning): add analyzer, staging, and lifecycle policy files"
```

---

## Chunk 3: New Commands

### Task 6: Create /build-ingest command spec

**Files:**
- Create: `build/commands/build-ingest.md`

- [ ] **Step 1: Create build-ingest.md**

```markdown
---
description: "Analyze logs from any source, extract candidate patterns, stage for review"
---

# /build-ingest — Log Analysis & Pattern Extraction

## Purpose
Read log data from a file, analyze it for meaningful patterns, and stage candidates for user review. Format-agnostic — handles JSON, plain text, CSV, metrics, stack traces, or any other format.

## Context Pack
Load: `learning/analyzer.md`, `learning/staging-policy.md`
Also load: `state/learned-patterns.json`, `state/staging-patterns.json`

## Input
- File path provided by user (required)
- API integration: future extension

## Steps

1. **Read log data**
   - Read the file at the provided path
   - Do not assume any specific format — interpret content semantically

2. **Analyze for patterns**
   - Follow extraction rules in `learning/analyzer.md`
   - Extract across all categories: operational, failure, architecture, performance, process
   - Each candidate must have: description, why, category

3. **Deduplicate**
   - Compare each candidate semantically against existing patterns in `learned-patterns.json`
   - If >80% semantic overlap with an existing pattern, reinforce that pattern instead of creating new
   - Report reinforcements separately from new candidates

4. **Stage candidates**
   - Write new candidates to `staging-patterns.json` via `PatternManager.addStaged()`
   - Set `source: log_analysis`, `trust: low`, `confidence: 0.5`
   - Set `source_reference` to the file path analyzed

5. **Report**
   - Show extraction summary to user

## Governance Checks
- No secrets, credentials, or PII in extracted patterns
- Patterns must include `why` with evidence from logs
- Candidates must not contradict existing governance rules

## State Updates
- `staging-patterns.json`: new candidates added
- `learned-patterns.json`: reinforced patterns updated (if duplicates found)

## Output
` ` `
Log Analysis Complete
  Source: {file_path}
  Patterns Extracted: {n} new, {n} reinforced
  Staged for Review: {n}
  Next: /build-audit staged
` ` `
```

- [ ] **Step 2: Commit**

```bash
git add build/commands/build-ingest.md
git commit -m "feat(learning): add /build-ingest command spec"
```

---

### Task 7: Create /build-audit command spec

**Files:**
- Create: `build/commands/build-audit.md`

- [ ] **Step 1: Create build-audit.md**

```markdown
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
3. Show learning health dashboard:

## Governance Checks
- Approved patterns must not contradict governance rules
- Approved patterns must include `why`
- 50-pattern cap enforced at approval time

## State Updates
- `staging-patterns.json`: candidates removed (approved or rejected)
- `learned-patterns.json`: approved patterns added, expired patterns updated

## Output (full audit)
` ` `
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
└─ Archived: {n}
` ` `
```

- [ ] **Step 2: Commit**

```bash
git add build/commands/build-audit.md
git commit -m "feat(learning): add /build-audit command spec"
```

---

### Task 8: Create /build-remember command spec

**Files:**
- Create: `build/commands/build-remember.md`

- [ ] **Step 1: Create build-remember.md**

```markdown
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
` ` `
Pattern Saved (explicit / high trust / evergreen)
  [{category}] {description}
  Why: {why}
  ID: {pattern_id}
` ` `
```

- [ ] **Step 2: Commit**

```bash
git add build/commands/build-remember.md
git commit -m "feat(learning): add /build-remember command spec"
```

---

## Chunk 4: CLI Handlers & Hook Updates

### Task 9: Add CLI command handlers for ingest, audit, remember

**Files:**
- Modify: `build/bin/build-tools.cjs` — `Commands` object (search for `const Commands`)
- Modify: `build/bin/build-tools.cjs` — `main()` function help text (search for `console.log('Commands:')`)


- [ ] **Step 1: Add ingest command handler**

Add to the `Commands` object (before the `// --- Sub-operations` comment):

```javascript
  ingest(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const filePath = args[0];
    if (!filePath) {
      console.error('Usage: build-tools.cjs ingest <file-path>');
      console.error('Provide a log file path to analyze.');
      process.exit(1);
    }
    // Load current state for context
    const patterns = loadState('patterns') || { patterns: [] };
    const staging = loadState('staging') || { patterns: [] };
    console.log(`Ingest: Analyzing ${filePath}`);
    console.log(`Existing patterns: ${patterns.patterns.length} | Staged: ${staging.patterns.length}`);
    console.log('Use /build-ingest command to run full LLM-driven analysis.');
  },
```

- [ ] **Step 2: Add audit command handler**

```javascript
  audit(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const mode = args[0] || 'full';
    const validModes = ['staged', 'expiring', 'full'];
    if (!validModes.includes(mode)) {
      console.error(`Invalid mode: ${mode}. Use: ${validModes.join(', ')}`);
      process.exit(1);
    }

    if (mode === 'staged' || mode === 'full') {
      const staged = PatternManager.getStaged();
      console.log(`\nStaged Patterns: ${staged.length} pending review`);
      for (const p of staged) {
        console.log(`  ${p.id} [${p.category}] ${p.description}`);
        if (p.why) console.log(`    Why: ${p.why}`);
      }
    }

    if (mode === 'expiring' || mode === 'full') {
      const expiring = PatternManager.getExpiring(14);
      console.log(`\nExpiring Patterns: ${expiring.length} within 14 days`);
      for (const p of expiring) {
        console.log(`  ${p.id} [${p.category}] ${p.description} (expires: ${p.expires_at})`);
      }
    }

    if (mode === 'full') {
      const health = PatternManager.getLearningHealth();
      console.log(`\nLearning Health`);
      console.log(`├─ Active patterns: ${health.active} (${health.high_trust} high, ${health.medium_trust} medium, ${health.low_trust} low trust)`);
      console.log(`├─ Staged (pending review): ${health.staged}`);
      console.log(`├─ Expiring within 14 days: ${health.expiring}`);
      console.log(`├─ Expired: ${health.expired}`);
      console.log(`└─ Archived: ${health.archived}`);
    }
  },

  remember(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const description = args[0] || '';
    const why = args[1] || '';
    if (!description) {
      console.error('Usage: build-tools.cjs remember <description> <why>');
      process.exit(1);
    }
    if (!why) {
      console.error('A "why" reason is required. No naked rules without reasoning.');
      console.error('Usage: build-tools.cjs remember <description> <why>');
      process.exit(1);
    }
    const pat = PatternManager.addPattern({
      category: 'explicit',
      description,
      why: why || null,
      source: 'explicit',
      trust: 'high',
      ttl_days: 0,
      confidence: 0.9,
    });
    if (pat.error) {
      console.error(pat.error);
      process.exit(1);
    }
    console.log(`Pattern Saved (explicit / high trust / evergreen)`);
    console.log(`  [${pat.category}] ${pat.description}`);
    if (pat.why) console.log(`  Why: ${pat.why}`);
    console.log(`  ID: ${pat.id}`);
  },
```

- [ ] **Step 3: Update help text in main()**

Add these lines to the help output (search for `add-blocker` in the help text, add after it):

```javascript
    console.log('  ingest <file>                Analyze logs for patterns');
    console.log('  audit [staged|expiring]      Review and manage learned patterns');
    console.log('  remember <desc> [why]        Save explicit teaching pattern');
```

- [ ] **Step 4: Test all three handlers**

Run: `node build/bin/build-tools.cjs audit`
Expected: Learning health output (all zeros for fresh state)

Run: `node build/bin/build-tools.cjs remember "always use connection pooling" "prevents connection exhaustion under load"`
Expected: Pattern saved confirmation

Run: `node build/bin/build-tools.cjs audit`
Expected: Shows 1 active pattern (high trust)

- [ ] **Step 5: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(learning): add ingest, audit, remember CLI handlers"
```

---

### Task 10: Update session-start hook with learning nudge

**Files:**
- Modify: `build/bin/build-tools.cjs` — `Hooks.sessionStart()` method (search for `sessionStart()`)

- [ ] **Step 1: Add learning nudge to sessionStart**

Replace the `sessionStart()` method in `Hooks`:

```javascript
  sessionStart() {
    // Reset hook counters for new session
    saveJSON(HOOK_COUNTER_FILE, { preBash: 0, preEdit: 0, postEdit: 0, postBash: 0 });

    if (!StateManager.isInitialized()) {
      return 'BuildOS: Not initialized. Run /build-init.';
    }
    const project = loadState('project');
    const sprint = SprintManager.getActive();

    // Pre-warm caches at session start
    Governance.loadRules();
    if (sprint) {
      ContextCache.isSprintCurrent(sprint.sprint_id);
    }

    // Run migration if needed (one-time)
    PatternManager.migrate();

    // Expire sweep
    const expired = PatternManager.expireSweep();

    let msg = `BuildOS: "${project.name}" | Gov: ${project.governance_version}\n`;
    if (sprint) {
      const stats = TaskManager.getStats(sprint.sprint_id);
      msg += `Sprint: ${sprint.sprint_id} — ${sprint.goal} (${stats.completed}/${stats.total})\n`;
    } else {
      msg += 'No active sprint.\n';
    }

    // Learning nudge
    const staged = PatternManager.getStaged();
    const expiring = PatternManager.getExpiring(14);
    if (staged.length > 0 || expiring.length > 0) {
      const parts = [];
      if (staged.length > 0) parts.push(`${staged.length} patterns pending review`);
      if (expiring.length > 0) parts.push(`${expiring.length} expiring soon`);
      msg += `Learning: ${parts.join(', ')}. Run /build-audit when ready.\n`;
    }
    if (expired > 0) {
      msg += `Expired: ${expired} patterns marked expired this session.\n`;
    }

    return msg;
  },
```

- [ ] **Step 2: Test session start**

Run: `node build/bin/build-tools.cjs hook session-start`
Expected: BuildOS status message, possibly with learning nudge if patterns exist

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(learning): add migration, expiry sweep, and learning nudge to session start"
```

---

### Task 11: Add learning health to StatusReporter

**Files:**
- Modify: `build/bin/build-tools.cjs` (StatusReporter.generate — find and extend)

- [ ] **Step 1: Find StatusReporter.generate()**

Search for `StatusReporter` in `build-tools.cjs` and locate the `generate()` method.

- [ ] **Step 2: Add learning health section**

At the end of the `generate()` method, before the final return, add:

```javascript
    // Learning Health
    const health = PatternManager.getLearningHealth();
    lines.push('');
    lines.push('Learning Health');
    lines.push(`├─ Active patterns: ${health.active} (${health.high_trust} high, ${health.medium_trust} medium, ${health.low_trust} low trust)`);
    lines.push(`├─ Staged (pending review): ${health.staged}`);
    lines.push(`├─ Expiring within 14 days: ${health.expiring}`);
    lines.push(`├─ Expired: ${health.expired}`);
    lines.push(`└─ Archived: ${health.archived}`);
```

- [ ] **Step 3: Test status output**

Run: `node build/bin/build-tools.cjs status`
Expected: Full status dashboard including new "Learning Health" section at the bottom

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(learning): add learning health section to status dashboard"
```

---

## Chunk 5: Update /build-learn with Inline Approval Gate

### Task 12: Modify build-learn.md command spec

**Files:**
- Modify: `build/commands/build-learn.md`

- [ ] **Step 1: Add inline approval gate to step 5**

In `build-learn.md`, replace step 5 ("Update pattern registry") with:

```markdown
5. **Update pattern registry (with inline approval)**
   - For each extracted pattern, present to user:
     - Category, description, why, confidence
   - Ask user: **approve** / **reject** / **edit** for each
   - Only approved patterns are saved via `PatternManager.addPattern()` with `source: "sprint_review"`, `trust: "medium"`, `ttl_days: 90`
   - Rejected patterns are discarded
   - Edited patterns: apply user modifications, then save
   - Check for duplicates: if >80% semantic overlap with existing pattern, reinforce instead of creating new
   - Increment `times_applied` for reinforced patterns via `PatternManager.reinforcePattern()`
```

- [ ] **Step 2: Update output template**

Replace the output section to include approval counts:

```markdown
## Output
` ` `
Learning Recorded
  Sprint: {sprint_id} — COMPLETED
  Patterns: {n} approved, {n} rejected, {n} reinforced
  ADRs Recorded: {n}
  Summary: compressed to {n} tokens
  Context Budget: {used}/{max}
  Sprints Completed: {total}
  Next: /build-sprint (next sprint) or /build-status (review state)
` ` `
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-learn.md
git commit -m "feat(learning): add inline approval gate to /build-learn pattern extraction"
```

---

## Chunk 6: Update build-status.md Spec

### Task 13: Add learning health to build-status.md command spec

**Files:**
- Modify: `build/commands/build-status.md`

- [ ] **Step 1: Add learning health step**

After step 8 ("Recent patterns"), add:

```markdown
9. **Learning health**
   - Active pattern count by trust level (high, medium, low)
   - Staged patterns pending review
   - Patterns expiring within 14 days
   - Archived pattern count
```

- [ ] **Step 2: Update context pack**

Add `state/staging-patterns.json` to the context pack load list.

- [ ] **Step 3: Update output template**

Add after "Recent Patterns" in the output:

```markdown
Learning Health
├─ Active patterns: {n} ({high} high, {med} medium, {low} low trust)
├─ Staged (pending review): {n}
├─ Expiring within 14 days: {n}
└─ Archived: {n}
```

- [ ] **Step 4: Commit**

```bash
git add build/commands/build-status.md
git commit -m "feat(learning): add learning health to /build-status spec"
```

---

## Chunk 7: Slash Command Aliases

### Task 14: Create .claude/commands entries for new commands

**Files:**
- Create: `.claude/commands/build-ingest.md`
- Create: `.claude/commands/build-audit.md`
- Create: `.claude/commands/build-remember.md`

- [ ] **Step 1: Check existing command file format**

Read one of the existing `.claude/commands/build-*.md` files to match the format.

- [ ] **Step 2: Create build-ingest.md slash command**

Match the format of existing commands. This file tells Claude Code to load the command spec and run the workflow.

- [ ] **Step 3: Create build-audit.md slash command**

Same format, pointing to `build/commands/build-audit.md`.

- [ ] **Step 4: Create build-remember.md slash command**

Same format, pointing to `build/commands/build-remember.md`.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/build-ingest.md .claude/commands/build-audit.md .claude/commands/build-remember.md
git commit -m "feat(learning): add slash command aliases for ingest, audit, remember"
```

---

## Chunk 8: End-to-End Verification

### Task 15: Full integration test

- [ ] **Step 1: Verify clean load**

Run: `node build/bin/build-tools.cjs status`
Expected: Status dashboard with Learning Health section, no errors

- [ ] **Step 2: Test explicit teaching flow**

Run: `node build/bin/build-tools.cjs remember "always validate input at API boundaries" "prevents injection attacks and data corruption"`
Expected: Pattern saved with trust: high, ttl_days: 0

- [ ] **Step 3: Test session start nudge**

Run: `node build/bin/build-tools.cjs hook session-start`
Expected: BuildOS status. If patterns exist, shows learning info.

- [ ] **Step 4: Test audit command (all modes)**

Run: `node build/bin/build-tools.cjs audit staged`
Run: `node build/bin/build-tools.cjs audit expiring`
Run: `node build/bin/build-tools.cjs audit`
Expected: Each mode runs without errors, shows appropriate output

- [ ] **Step 5: Test help text**

Run: `node build/bin/build-tools.cjs`
Expected: Help output includes `ingest`, `audit`, `remember` commands

- [ ] **Step 6: Verify all new files exist**

Check:
- `build/learning/analyzer.md`
- `build/learning/staging-policy.md`
- `build/learning/lifecycle-policy.md`
- `build/commands/build-ingest.md`
- `build/commands/build-audit.md`
- `build/commands/build-remember.md`
- `build/state/staging-patterns.json`
- `.claude/commands/build-ingest.md`
- `.claude/commands/build-audit.md`
- `.claude/commands/build-remember.md`

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat(learning): integration verification and fixes"
```
