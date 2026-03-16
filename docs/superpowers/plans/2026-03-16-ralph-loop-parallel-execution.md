# Ralph Loop: Wave-Based Parallel Execution — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in wave-based parallel execution to `/build-execute --parallel`, enabling independent sprint tasks to run as concurrent agents in isolated worktrees with synchronized context between waves.

**Architecture:** Three new managers (DAGBuilder, LedgerManager, MergeValidator) added to `build-tools.cjs` between StatusReporter (line ~1004) and Hooks (line ~1023). New CLI subcommands (`dag`, `ledger`, `merge`) route through the existing Commands object and main() dispatcher. Markdown command/workflow files get parallel-mode addenda.

**Tech Stack:** Node.js (CommonJS), JSON state files, Claude Code Agent tool with `isolation: "worktree"`

**Spec:** `docs/superpowers/specs/2026-03-16-ralph-loop-parallel-execution-design.md`

---

## Chunk 1: DAGBuilder Manager

### Task 1: Add STATE_FILES entry for execution ledger

**Files:**
- Modify: `build/bin/build-tools.cjs:18-26` (STATE_FILES constant)

- [ ] **Step 1: Add ledger to STATE_FILES**

Add `ledger: 'execution-ledger.json'` to the STATE_FILES constant at line 26, before the closing brace:

```javascript
const STATE_FILES = {
  project: 'current-project.json',
  roadmap: 'roadmap.json',
  sprint: 'sprint-state.json',
  task: 'task-state.json',
  context: 'context-state.json',
  patterns: 'learned-patterns.json',
  staging: 'staging-patterns.json',
  ledger: 'execution-ledger.json',
};
```

- [ ] **Step 2: Verify no breakage**

Run: `node build/bin/build-tools.cjs`
Expected: Usage help text prints without errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add execution-ledger to STATE_FILES"
```

---

### Task 2: Implement DAGBuilder

**Files:**
- Modify: `build/bin/build-tools.cjs` (insert after line ~1004, before Hooks section)

- [ ] **Step 1: Write the DAGBuilder test cases mentally, then implement**

Insert the DAGBuilder object after StatusReporter and before the Hooks section (~line 1004). The DAGBuilder has three methods: `build`, `tier`, and `recalculate`.

```javascript
// ---------------------------------------------------------------------------
// DAGBuilder — topological sort sprint tasks into parallelizable waves
// ---------------------------------------------------------------------------

const TIER3_KEYWORDS = ['migrate', 'auth', 'schema', 'security', 'perf', 'migration', 'performance'];
const TIER2_KEYWORDS = ['integrate', 'connect', 'extend'];

const DAGBuilder = {
  /**
   * Build DAG from sprint tasks, group into waves via topological sort.
   * @param {Array} tasks - [{id, depends_on, file_scope, title, description, status}]
   * @returns {{waves, parallelizable, max_concurrency} | {error}}
   */
  build(tasks) {
    // Filter to pending tasks only
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) {
      return { error: 'No pending tasks to execute.' };
    }

    const taskMap = new Map(pending.map(t => [t.id, t]));
    const inDegree = new Map();
    const adjList = new Map();

    for (const t of pending) {
      inDegree.set(t.id, 0);
      adjList.set(t.id, []);
    }

    // Build adjacency list and in-degree counts
    for (const t of pending) {
      for (const dep of (t.depends_on || [])) {
        // Skip deps on non-pending tasks (already completed)
        if (!taskMap.has(dep)) continue;
        adjList.get(dep).push(t.id);
        inDegree.set(t.id, inDegree.get(t.id) + 1);
      }
    }

    // Kahn's algorithm for cycle detection + topological sort
    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted = [];
    const depth = new Map();

    // Initialize roots at depth 0
    for (const id of queue) {
      depth.set(id, 0);
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      processed++;

      for (const neighbor of adjList.get(current)) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        // Depth = max depth of all dependencies + 1
        const newDepth = Math.max(depth.get(neighbor) || 0, depth.get(current) + 1);
        depth.set(neighbor, newDepth);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Cycle detection
    if (processed !== pending.length) {
      const inCycle = pending.filter(t => !sorted.includes(t.id)).map(t => t.id);
      return { error: `Cycle detected in task dependencies: ${inCycle.join(' → ')}. Fix task dependencies before running --parallel.` };
    }

    // Group into waves by depth
    const waveMap = new Map();
    for (const [id, d] of depth) {
      if (!waveMap.has(d)) waveMap.set(d, []);
      waveMap.get(d).push(id);
    }

    const waves = [];
    const sortedDepths = [...waveMap.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedDepths.length; i++) {
      waves.push({
        id: i + 1,
        units: waveMap.get(sortedDepths[i]).sort(),
      });
    }

    const maxConcurrency = Math.max(...waves.map(w => w.units.length));
    const parallelizable = maxConcurrency > 1;

    return { waves, parallelizable, max_concurrency: maxConcurrency };
  },

  /**
   * Classify each task into a complexity tier (1, 2, or 3).
   * @param {Array} tasks - task objects with file_scope and description
   * @returns {Object} map of task_id → {tier, model, reason}
   */
  tier(tasks) {
    const result = {};
    for (const t of tasks) {
      const desc = (t.description || '').toLowerCase() + ' ' + (t.title || '').toLowerCase();
      const fileCount = (t.file_scope || []).length;

      // Keyword override: Tier 3
      const hasTier3Keyword = TIER3_KEYWORDS.some(kw => desc.includes(kw));
      if (hasTier3Keyword || fileCount >= 7) {
        result[t.id] = { tier: 3, model: 'opus', reason: hasTier3Keyword ? 'keyword match' : 'file count >= 7' };
        continue;
      }

      // Tier 2
      const hasTier2Keyword = TIER2_KEYWORDS.some(kw => desc.includes(kw));
      if (hasTier2Keyword || fileCount >= 3) {
        result[t.id] = { tier: 2, model: 'sonnet', reason: hasTier2Keyword ? 'keyword match' : 'file count 3-6' };
        continue;
      }

      // Default: Tier 1
      result[t.id] = { tier: 1, model: 'sonnet', reason: 'isolated change' };
    }
    return result;
  },

  /**
   * Recalculate waves after removing failed/blocked tasks.
   * @param {Array} tasks - full task list (will filter to pending only)
   * @returns same as build()
   */
  recalculate(tasks) {
    return this.build(tasks);
  },
};
```

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No syntax errors.

- [ ] **Step 3: Manual smoke test**

Run: `node -e "
const DAGBuilder = require('./build/bin/build-tools.cjs').DAGBuilder || 'not exported';
console.log(typeof DAGBuilder);
"`

Note: DAGBuilder is not exported (it's internal to the CJS module). Verification will happen through CLI subcommands in Task 4. For now, syntax check is sufficient.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add DAGBuilder with topological sort and tier classification"
```

---

### Task 3: Add `dag` CLI subcommands

**Files:**
- Modify: `build/bin/build-tools.cjs` (Commands object ~line 1188, main() help text ~line 1543)

- [ ] **Step 1: Add dag command handler to Commands object**

Add inside the Commands object (after the `validate` command, before closing brace ~line 1515):

```javascript
  dag(args) {
    const sub = args[0];
    if (!sub || !['build', 'tier', 'recalculate'].includes(sub)) {
      console.error('Usage: dag <build|tier|recalculate>');
      process.exit(1);
    }

    const taskState = loadState('task');
    if (!taskState || !taskState.tasks || taskState.tasks.length === 0) {
      console.error('No tasks found in task-state.json');
      process.exit(1);
    }

    if (sub === 'build' || sub === 'recalculate') {
      const result = DAGBuilder.build(taskState.tasks);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'tier') {
      const pending = taskState.tasks.filter(t => t.status === 'pending');
      const result = DAGBuilder.tier(pending);
      console.log(JSON.stringify(result, null, 2));
    }
  },
```

- [ ] **Step 2: Add help text for dag command**

In the `main()` function, find the help section by searching for `console.log('Commands:')`. Add after the last existing help line:

```javascript
    console.log('  dag <build|tier|recalculate> DAG operations for parallel execution');
```

**Note:** Line numbers shift as code is inserted in earlier tasks. Always search for landmarks (`const Commands = {`, `function main()`, `console.log('Commands:')`) rather than relying on absolute line numbers.

- [ ] **Step 3: Test with mock data**

Create a temporary test state file:

```bash
cat > /tmp/test-task-state.json << 'EOF'
{
  "tasks": [
    {"id": "T1", "title": "Create user model", "status": "pending", "depends_on": [], "file_scope": ["src/models/user.ts"], "description": "Add user entity"},
    {"id": "T2", "title": "Create order model", "status": "pending", "depends_on": [], "file_scope": ["src/models/order.ts"], "description": "Add order entity"},
    {"id": "T3", "title": "Add auth middleware", "status": "pending", "depends_on": ["T1"], "file_scope": ["src/middleware/auth.ts"], "description": "Add authentication"},
    {"id": "T4", "title": "Connect user to orders", "status": "pending", "depends_on": ["T1", "T2"], "file_scope": ["src/services/user-orders.ts"], "description": "Integrate user-order relationship"},
    {"id": "T5", "title": "Add API routes", "status": "pending", "depends_on": ["T3", "T4"], "file_scope": ["src/routes/api.ts"], "description": "Add REST endpoints"}
  ]
}
EOF
```

Copy to state dir temporarily:
```bash
cp build/state/task-state.json build/state/task-state.json.bak
cp /tmp/test-task-state.json build/state/task-state.json
node build/bin/build-tools.cjs dag build
node build/bin/build-tools.cjs dag tier
cp build/state/task-state.json.bak build/state/task-state.json
```

Expected `dag build` output:
```json
{
  "waves": [
    { "id": 1, "units": ["T1", "T2"] },
    { "id": 2, "units": ["T3", "T4"] },
    { "id": 3, "units": ["T5"] }
  ],
  "parallelizable": true,
  "max_concurrency": 2
}
```

Expected `dag tier` output: T3 should be tier 3 (keyword "auth"), T4 tier 2 (keyword "integrate"), T1/T2 tier 1.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add dag CLI subcommands (build, tier, recalculate)"
```

---

## Chunk 2: LedgerManager & MergeValidator

### Task 4: Implement LedgerManager

**Files:**
- Modify: `build/bin/build-tools.cjs` (insert after DAGBuilder, before Hooks)

- [ ] **Step 1: Add WAVES_DIR constant**

Add after the existing constants (~line 16):

```javascript
const WAVES_DIR = path.join(STATE_DIR, 'waves');
```

- [ ] **Step 2: Implement LedgerManager**

Insert after DAGBuilder:

```javascript
// ---------------------------------------------------------------------------
// LedgerManager — execution ledger for wave-based parallel execution
// ---------------------------------------------------------------------------

const LedgerManager = {
  _ledgerPath() {
    return stateFile('ledger');
  },

  _wavePath(waveId) {
    return path.join(WAVES_DIR, `wave-${waveId}.json`);
  },

  _snapshotPath(waveId, unitId) {
    return path.join(WAVES_DIR, `wave-${waveId}-${unitId}-snapshot.json`);
  },

  init(sprintId) {
    if (!fs.existsSync(WAVES_DIR)) {
      fs.mkdirSync(WAVES_DIR, { recursive: true });
    }
    const ledger = {
      sprint_id: sprintId,
      mode: 'parallel',
      current_wave: 0,
      waves_completed: [],
      decisions: [],
      interfaces_defined: [],
      warnings: [],
      failed_units: [],
    };
    saveJSON(this._ledgerPath(), ledger);
    return ledger;
  },

  load() {
    return loadJSON(this._ledgerPath());
  },

  save(ledger) {
    saveJSON(this._ledgerPath(), ledger);
  },

  appendDecision(wave, unitId, decision) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.decisions.push({
      wave,
      unit_id: unitId,
      type: 'decision',
      description: decision.description,
      files_affected: decision.files_affected || [],
      timestamp: now(),
    });
    this.save(ledger);
  },

  appendInterface(wave, unitId, iface) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.interfaces_defined.push({
      wave,
      unit_id: unitId,
      name: iface.name,
      file: iface.file,
      exports: iface.exports || [],
    });
    this.save(ledger);
  },

  appendWarning(wave, unitId, warning) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.warnings.push({
      wave,
      unit_id: unitId,
      description: warning,
      timestamp: now(),
    });
    this.save(ledger);
  },

  appendFailure(unitId, wave, reason, downstream) {
    const ledger = this.load();
    if (!ledger) return;
    const snapshotPath = this._snapshotPath(wave, unitId);
    ledger.failed_units.push({
      unit_id: unitId,
      wave,
      reason,
      snapshot_path: snapshotPath,
      downstream_blocked: downstream || [],
    });
    this.save(ledger);
    return snapshotPath;
  },

  snapshotWave(waveId, results) {
    const wavePath = this._wavePath(waveId);
    saveJSON(wavePath, {
      wave_id: waveId,
      completed_at: now(),
      results,
    });
    const ledger = this.load();
    if (ledger) {
      ledger.waves_completed.push(waveId);
      ledger.current_wave = waveId;
      this.save(ledger);
    }
  },

  snapshotFailure(waveId, unitId, failureData) {
    const snapshotPath = this._snapshotPath(waveId, unitId);
    saveJSON(snapshotPath, {
      unit_id: unitId,
      wave: waveId,
      failure_reason: failureData.failure_reason || 'unknown',
      partial_work: failureData.partial_work || {},
      worktree_preserved: true,
      downstream_blocked: failureData.downstream_blocked || [],
      retry_hint: failureData.retry_hint || null,
      snapshot_at: now(),
    });
    return snapshotPath;
  },

  getCumulativeLedger(tokenBudget = 800) {
    const ledger = this.load();
    if (!ledger) return { decisions: [], interfaces_defined: [], warnings: [] };

    const completedWaves = ledger.waves_completed || [];
    const cutoff = Math.max(0, ledger.current_wave - 2);

    // Compress old waves: decisions/interfaces from waves <= cutoff get one-line summaries
    const recentDecisions = [];
    const oldSummaries = [];

    for (const d of ledger.decisions) {
      if (d.wave <= cutoff) {
        oldSummaries.push(`Wave ${d.wave}/${d.unit_id}: ${d.description}`);
      } else {
        recentDecisions.push(d);
      }
    }

    const result = {
      current_wave: ledger.current_wave,
      prior_wave_summaries: oldSummaries,
      recent_decisions: recentDecisions,
      interfaces_defined: ledger.interfaces_defined,
      warnings: ledger.warnings,
      failed_units: ledger.failed_units,
    };

    // Token check — if over budget, further compress
    const estimate = TokenCounter.estimate(JSON.stringify(result));
    if (estimate > tokenBudget) {
      // Drop old summaries first, then truncate decisions
      result.prior_wave_summaries = oldSummaries.slice(-3);
      result.warnings = ledger.warnings.slice(-5);
    }

    return result;
  },

  finalize() {
    const ledger = this.load();
    if (!ledger) return 'No ledger found.';

    const totalWaves = ledger.waves_completed.length;
    const totalDecisions = ledger.decisions.length;
    const totalFailed = ledger.failed_units.length;
    const totalInterfaces = ledger.interfaces_defined.length;

    const lines = [
      `Ralph Loop Execution Complete`,
      `  Sprint: ${ledger.sprint_id}`,
      `  Waves completed: ${totalWaves}`,
      `  Decisions recorded: ${totalDecisions}`,
      `  Interfaces defined: ${totalInterfaces}`,
      `  Failed units: ${totalFailed}`,
    ];

    if (totalFailed > 0) {
      lines.push(`  Failed:`);
      for (const f of ledger.failed_units) {
        lines.push(`    - ${f.unit_id} (wave ${f.wave}): ${f.reason}`);
        if (f.downstream_blocked.length > 0) {
          lines.push(`      Blocked: ${f.downstream_blocked.join(', ')}`);
        }
      }
    }

    return lines.join('\n');
  },

  cleanup() {
    // Remove ledger file
    const ledgerPath = this._ledgerPath();
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
    // Remove waves directory
    if (fs.existsSync(WAVES_DIR)) {
      const files = fs.readdirSync(WAVES_DIR);
      for (const f of files) {
        fs.unlinkSync(path.join(WAVES_DIR, f));
      }
      fs.rmdirSync(WAVES_DIR);
    }
  },
};
```

- [ ] **Step 3: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No syntax errors.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add LedgerManager for wave execution state"
```

---

### Task 5: Implement MergeValidator

**Files:**
- Modify: `build/bin/build-tools.cjs` (insert after LedgerManager, before Hooks)

- [ ] **Step 1: Implement MergeValidator**

```javascript
// ---------------------------------------------------------------------------
// MergeValidator — check for file conflicts between parallel units
// ---------------------------------------------------------------------------

const MergeValidator = {
  /**
   * Validate that no file was touched by more than one unit in a wave.
   * @param {Array} unitReports - [{unit_id, files_modified, files_created}]
   * @returns {{valid: boolean, conflicts?: Array}}
   */
  validate(unitReports) {
    const fileOwnership = new Map(); // file → [unit_ids]

    for (const report of unitReports) {
      const allFiles = [
        ...(report.files_modified || []),
        ...(report.files_created || []),
      ];
      for (const file of allFiles) {
        if (!fileOwnership.has(file)) fileOwnership.set(file, []);
        fileOwnership.get(file).push(report.unit_id);
      }
    }

    const conflicts = [];
    for (const [file, units] of fileOwnership) {
      if (units.length > 1) {
        conflicts.push({ file, units });
      }
    }

    if (conflicts.length > 0) {
      return {
        valid: false,
        conflicts,
        message: conflicts.map(c =>
          `✗ Units ${c.units.join(' and ')} both touched ${c.file}\n  Fix: Add dependency between tasks ${c.units.join(' → ')} (or reverse)`
        ).join('\n'),
      };
    }

    return { valid: true };
  },
};
```

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add MergeValidator for file conflict detection"
```

---

### Task 6: Add `ledger` and `merge` CLI subcommands

**Files:**
- Modify: `build/bin/build-tools.cjs` (Commands object, main() help)

- [ ] **Step 1: Add ledger command handler**

Add to Commands object:

```javascript
  ledger(args) {
    const sub = args[0];
    if (!sub || !['init', 'read', 'update', 'finalize', 'cleanup'].includes(sub)) {
      console.error('Usage: ledger <init|read|update|finalize|cleanup>');
      process.exit(1);
    }

    if (sub === 'init') {
      const sprint = loadState('sprint');
      const sprintId = sprint?.active_sprint?.id || 'unknown';
      LedgerManager.init(sprintId);
      console.log(`Ledger initialized for sprint ${sprintId}`);
    } else if (sub === 'read') {
      const budget = parseInt(args[1]) || 800;
      const result = LedgerManager.getCumulativeLedger(budget);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'update') {
      const waveId = parseInt(args[1]);
      if (!waveId) {
        console.error('Usage: ledger update <wave-number> (pipe JSON results via stdin or pass as arg)');
        process.exit(1);
      }
      // Read wave results from a JSON file path (array of unit-report.json objects)
      // Expected schema: array of unit-report objects, each matching unit-report-template.md:
      // [{unit_id, status, files_modified, files_created, decisions, interfaces_defined, warnings, failure_reason}]
      let results = [];
      if (args[2]) {
        try {
          if (fs.existsSync(args[2])) {
            results = JSON.parse(fs.readFileSync(args[2], 'utf-8'));
          } else {
            results = JSON.parse(args[2]);
          }
        } catch {
          console.error('Could not parse wave results. Expected JSON array of unit-report objects.');
          process.exit(1);
        }
      }

      // Also update the cumulative ledger with decisions/interfaces from each unit report
      const ledger = LedgerManager.load();
      if (ledger && Array.isArray(results)) {
        for (const report of results) {
          if (report.status === 'completed') {
            for (const d of (report.decisions || [])) {
              LedgerManager.appendDecision(waveId, report.unit_id, d);
            }
            for (const i of (report.interfaces_defined || [])) {
              LedgerManager.appendInterface(waveId, report.unit_id, i);
            }
            for (const w of (report.warnings || [])) {
              LedgerManager.appendWarning(waveId, report.unit_id, w);
            }
          }
        }
      }

      LedgerManager.snapshotWave(waveId, results);
      console.log(`Wave ${waveId} snapshot saved. Ledger updated with ${results.length} unit reports.`);
    } else if (sub === 'finalize') {
      console.log(LedgerManager.finalize());
    } else if (sub === 'cleanup') {
      LedgerManager.cleanup();
      console.log('Ledger and wave snapshots cleaned up.');
    }
  },

  merge(args) {
    const sub = args[0];
    if (sub !== 'validate') {
      console.error('Usage: merge validate <wave-number>');
      console.error('  Reads unit reports from state/waves/wave-<N>.json');
      console.error('  OR pass a JSON file path as second arg: merge validate <wave> <reports.json>');
      process.exit(1);
    }

    const waveNum = parseInt(args[1]);
    let reports;

    if (args[2] && fs.existsSync(args[2])) {
      // Direct file path override (for testing)
      try {
        reports = JSON.parse(fs.readFileSync(args[2], 'utf-8'));
      } catch (err) {
        console.error(`Error reading reports file: ${err.message}`);
        process.exit(1);
      }
    } else if (waveNum) {
      // Read from wave snapshot
      const wavePath = path.join(WAVES_DIR, `wave-${waveNum}.json`);
      if (!fs.existsSync(wavePath)) {
        console.error(`Wave snapshot not found: ${wavePath}`);
        console.error('Run ledger update first, or provide a reports file path.');
        process.exit(1);
      }
      try {
        const waveData = JSON.parse(fs.readFileSync(wavePath, 'utf-8'));
        reports = waveData.results || [];
      } catch (err) {
        console.error(`Error reading wave snapshot: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.error('Provide a wave number or reports file path.');
      process.exit(1);
    }

    const result = MergeValidator.validate(Array.isArray(reports) ? reports : [reports]);
    if (result.valid) {
      console.log('PASS — no file conflicts detected.');
    } else {
      console.log('FAIL — file conflicts detected:');
      console.log(result.message);
      process.exit(1);
    }
  },
```

- [ ] **Step 2: Add help text**

In main() help section (search for `console.log('Commands:')`), add after the dag help line:

```javascript
    console.log('  ledger <init|read|update|finalize|cleanup>  Execution ledger operations');
    console.log('  merge validate <wave> [reports.json]        Validate file conflicts');
```

Also update the existing `execute` help line to mention the parallel flag:

```javascript
    console.log('  execute [--parallel] [--max-agents N]  Execute next task (or parallel waves)');
```

- [ ] **Step 3: Test ledger init and read**

```bash
node build/bin/build-tools.cjs ledger init
node build/bin/build-tools.cjs ledger read
```

Expected: Init creates `build/state/execution-ledger.json` and `build/state/waves/` directory. Read returns empty ledger JSON.

- [ ] **Step 4: Test merge validate with clean data**

```bash
cat > /tmp/test-reports.json << 'EOF'
[
  {"unit_id": "T1", "files_modified": ["src/a.ts"], "files_created": []},
  {"unit_id": "T2", "files_modified": ["src/b.ts"], "files_created": []}
]
EOF
node build/bin/build-tools.cjs merge validate /tmp/test-reports.json
```

Expected: `PASS — no file conflicts detected.`

- [ ] **Step 5: Test merge validate with conflict**

```bash
cat > /tmp/test-conflict.json << 'EOF'
[
  {"unit_id": "T1", "files_modified": ["src/types.ts"], "files_created": []},
  {"unit_id": "T2", "files_modified": ["src/types.ts"], "files_created": []}
]
EOF
node build/bin/build-tools.cjs merge validate /tmp/test-conflict.json
```

Expected: `FAIL` with conflict message mentioning T1 and T2 both touched src/types.ts. Exit code 1.

- [ ] **Step 6: Clean up test artifacts**

```bash
node build/bin/build-tools.cjs ledger cleanup
rm /tmp/test-reports.json /tmp/test-conflict.json
```

- [ ] **Step 7: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(ralph-loop): add ledger and merge CLI subcommands"
```

---

## Chunk 3: Markdown Files (Command, Workflow, Agent, Context, Template)

### Task 7: Update build-execute.md with Parallel Mode section

**Files:**
- Modify: `build/commands/build-execute.md`

- [ ] **Step 1: Read current file**

Read `build/commands/build-execute.md` to find the right insertion point (after the existing Output section).

- [ ] **Step 2: Append Parallel Mode section**

Add at the end of the file:

```markdown
---

## Parallel Mode (`--parallel`)

When the `--parallel` flag is present, switch to wave-based parallel execution (Ralph Loop).

### Pre-Flight

1. Call `build-tools.cjs dag build` → returns wave plan as JSON
2. If result contains `error`, print error and abort
3. If `parallelizable` is `false`, print warning and fall back to sequential execution
4. Call `build-tools.cjs dag tier` → returns tier classification per task
5. Present wave plan with cost estimate to user, ask for confirmation:
   ```
   Wave Plan:
     Wave N: T-id (Tier X, Model), ...

     Opus units: N of M
     Proceed? (y/n)
   ```
6. If declined, abort and suggest sequential `/build-execute`
7. Call `build-tools.cjs ledger init` → creates execution-ledger.json

### Wave Loop

For each wave (starting from wave 1, or from next incomplete wave on resume):

**Step A — Read context:**
Call `build-tools.cjs ledger read` to get cumulative ledger from prior waves.

**Step B — Dispatch units:**
For each unit in the wave (up to `--max-agents N`, default 4):
- Assemble the agent prompt using the template below
- Dispatch via `Agent` tool with `isolation: "worktree"`
- All units in the wave (or sub-batch) dispatched in a single message (parallel)

**Step C — Collect results:**
After all agents complete, read `unit-report.json` from each worktree path.
If a unit-report.json is missing, treat the unit as failed with reason "agent did not produce unit-report.json".

**Step D — Validate merge:**
Collect all unit reports into a JSON array file.
Call `build-tools.cjs merge validate <reports.json>`
- If PASS: proceed to merge
- If FAIL: hard fail the wave, no merges applied, report DAG fix needed

**Step E — Handle failures:**
For any unit with status "failed" or "blocked":
1. Call `build-tools.cjs ledger` to record the failure
2. Identify downstream tasks that depend on the failed unit
3. Mark downstream tasks as `blocked_by_failure` in task-state.json
4. Preserve the failed unit's worktree branch

**Step F — Merge:**
For each passing unit (in task-ID order):
1. Merge the worktree branch into the sprint branch
2. Record decisions and interfaces from unit-report.json into ledger

**Step G — Update ledger:**
Call `build-tools.cjs ledger update <wave-number>` with wave results.

**Step H — Next wave:**
If more waves remain (with pending tasks), repeat from Step A.
If all waves complete or only blocked tasks remain, proceed to final report.

### Final Report

Call `build-tools.cjs ledger finalize` and display:

```
Ralph Loop Execution Complete
  Sprint: {sprint_id}
  Waves completed: N
  Units passed: N
  Units failed: N
  Units blocked: N

  Options:
  → /build-execute --parallel    Resume remaining waves
  → /build-execute               Switch to sequential
  → Fix failed units manually    Worktrees preserved
  Next: /build-verify (if all tasks complete)
```

### Agent Prompt Template

```
You are executing unit {unit_id} of sprint {sprint_id}, wave {wave_number}.

## Your Task
{task object extracted from state/task-state.json for this unit_id}

## Governance Rules
{standard execution pack governance — identical for all units}

## Context from Prior Waves
{cumulative ledger — decisions, interfaces, warnings}

## Tier: {1|2|3}
{tier-specific instructions — Tier 3 includes security-reviewer or relevant specialist guidance}

## Critical Constraints (Parallel Mode)
- You MUST NOT write to sprint-state.json or task-state.json
- You MUST NOT modify files outside your task's declared file_scope
- You MUST write unit-report.json before your session ends

## Output Requirements
After completing your work:
1. Commit all changes on your worktree branch
2. Write unit-report.json to the worktree root ({worktree-path}/unit-report.json):
{
  "unit_id": "{unit_id}",
  "status": "completed|failed|blocked",
  "files_modified": [],
  "files_created": [],
  "decisions": [{"description": "...", "files_affected": [...]}],
  "interfaces_defined": [{"name": "...", "file": "...", "exports": [...]}],
  "warnings": [],
  "failure_reason": null
}
```
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-execute.md
git commit -m "feat(ralph-loop): add parallel mode section to build-execute command"
```

---

### Task 8: Update execute workflow with parallel variant

**Files:**
- Modify: `build/engine/workflows/execute.md`

- [ ] **Step 1: Append parallel execution variant**

Add at the end of the file:

```markdown
---

## Parallel Execution Variant (Ralph Loop)

When `/build-execute --parallel` is used, the sequential workflow above is replaced by wave-based parallel execution. The key differences:

### What Changes

| Aspect | Sequential | Parallel |
|--------|-----------|----------|
| Task selection | Pick next pending by dependency order | DAGBuilder groups all tasks into waves |
| Execution | One task at a time, single context | Multiple tasks per wave, each in isolated worktree |
| Context | Reloaded per task from shared state | Per-unit execution pack + cumulative ledger |
| State updates | Executor writes to sprint-state.json directly | Orchestrator updates state after wave completion |
| Failure handling | Mark blocked, attempt next task | Evict failed unit, snapshot, recalculate DAG, continue |

### What Stays the Same

- Governance rules are loaded and obeyed identically
- Pre-commit hooks run in each worktree
- Task acceptance criteria must be met
- Coding standards enforced per governance rules
- Sprint completion triggers verification-ready transition

### Context Rotation

In sequential mode, context is cleared between tasks. In parallel mode:
- **Within a wave:** each agent has independent, isolated context (worktree)
- **Between waves:** orchestrator merges code and updates execution ledger
- **Ledger carries forward:** decisions, interfaces, and warnings from prior waves are included in the next wave's context pack

See `/build-execute` command definition for the full parallel mode protocol.
```

- [ ] **Step 2: Commit**

```bash
git add build/engine/workflows/execute.md
git commit -m "feat(ralph-loop): add parallel execution variant to execute workflow"
```

---

### Task 9: Update executor agent with parallel constraints

**Files:**
- Modify: `build/engine/agents/executor.md`

- [ ] **Step 1: Append parallel mode constraints**

Add at the end of the file:

```markdown

---

## Parallel Mode Constraints

When the executor agent is dispatched as part of a Ralph Loop wave (via `Agent` with `isolation: "worktree"`), the following additional constraints apply:

### State Isolation

- The executor **MUST NOT** write to `sprint-state.json` or `task-state.json`. In parallel mode, multiple executors run concurrently — shared state writes would cause race conditions. All state updates are handled by the orchestrator after wave completion.
- The executor **MUST NOT** modify files outside its task's declared `file_scope`. The MergeValidator will hard-fail the wave if two units touch the same file.

### Output Contract

- The executor **MUST** write `unit-report.json` to the worktree root before completing. This file is the executor's only communication channel back to the orchestrator.
- If the executor encounters a blocker and cannot complete the task, it must still write `unit-report.json` with `status: "blocked"` or `status: "failed"` and populate `failure_reason`.

### Ledger Awareness

- The executor receives a cumulative execution ledger containing decisions and interfaces from prior waves.
- The executor should **read** the ledger to understand what prior waves produced (e.g., interface shapes, architectural decisions).
- The executor should **report** its own decisions and interfaces in unit-report.json so the orchestrator can append them to the ledger for subsequent waves.

### Tier-Specific Behavior

- **Tier 1** (Sonnet): Standard execution. No specialist guidance.
- **Tier 2** (Sonnet): Standard execution. Code reviewer guidance included.
- **Tier 3** (Opus): Specialist guidance included (security-reviewer for auth tasks, architect for schema changes, etc.).
```

- [ ] **Step 2: Commit**

```bash
git add build/engine/agents/executor.md
git commit -m "feat(ralph-loop): add parallel mode constraints to executor agent"
```

---

### Task 10: Update execution context pack with parallel budget

**Files:**
- Modify: `build/context/templates/execution-pack.md`

- [ ] **Step 1: Append parallel mode additions**

Add at the end of the file:

```markdown

---

## Parallel Mode Additions

When assembling context for a Ralph Loop unit agent, the execution pack is modified:

### Modified Token Budget

| Layer | Sequential | Parallel | Change |
|-------|-----------|----------|--------|
| Sprint (filtered) | 800 | 500 | Only this unit's task, not full queue |
| Module (deep) | 1500 | 1500 | Unchanged |
| Rules | 1000 | 1000 | Unchanged |
| Governance (minimal) | 500 | 500 | Unchanged |
| Additional | 500 | 300 | Cross-module refs handled by ledger |
| **Ledger** | **—** | **800** | **Cumulative decisions from prior waves** |
| **Total** | **4300** | **4600** | +300 tokens |
| **Hard ceiling** | **5500** | **5800** | +300 tokens |

### Ledger Inclusion

The cumulative ledger is loaded via `build-tools.cjs ledger read 800` and included as a "Context from Prior Waves" section in the agent prompt. The 800-token budget ensures old waves are compressed while recent waves retain full detail.

### Tier-Specific Loading

| Tier | Additional Context |
|------|-------------------|
| 1 | None — standard rules only |
| 2 | Code reviewer agent guidance |
| 3 | Specialist agent guidance matching task keywords (security-reviewer, architect, etc.) |
```

- [ ] **Step 2: Commit**

```bash
git add build/context/templates/execution-pack.md
git commit -m "feat(ralph-loop): add parallel mode token budget to execution pack"
```

---

### Task 11: Create unit-report template

**Files:**
- Create: `build/engine/templates/unit-report-template.md`

- [ ] **Step 1: Write template**

```markdown
# Unit Report Template

## Purpose

Defines the schema for `unit-report.json` — the structured output that each parallel executor agent must produce. The orchestrator reads this file from each worktree after wave completion.

## Location

Each agent writes `unit-report.json` to the root of its worktree directory: `{worktree-path}/unit-report.json`

## Schema

```json
{
  "unit_id": "T-xxx",
  "status": "completed | failed | blocked",
  "files_modified": ["path/to/file.ts"],
  "files_created": ["path/to/new-file.ts"],
  "decisions": [
    {
      "description": "Human-readable description of architectural or design decision made",
      "files_affected": ["path/to/file.ts"]
    }
  ],
  "interfaces_defined": [
    {
      "name": "InterfaceName",
      "file": "path/to/types.ts",
      "exports": ["InterfaceName", "RelatedType"]
    }
  ],
  "warnings": ["Any concerns for subsequent waves"],
  "failure_reason": null
}
```

## Field Requirements

| Field | Required | Description |
|-------|----------|-------------|
| `unit_id` | Yes | Must match the task ID assigned to this unit |
| `status` | Yes | One of: `completed`, `failed`, `blocked` |
| `files_modified` | Yes | Array of file paths modified (can be empty) |
| `files_created` | Yes | Array of file paths created (can be empty) |
| `decisions` | Yes | Array of decisions made during implementation (can be empty) |
| `interfaces_defined` | Yes | Array of interfaces/types defined (can be empty) |
| `warnings` | Yes | Array of warning strings for subsequent waves (can be empty) |
| `failure_reason` | Conditional | Required if status is `failed` or `blocked`. Null if `completed`. |

## Missing Report Fallback

If the orchestrator cannot find `unit-report.json` after an agent completes, the unit is treated as:

```json
{
  "unit_id": "{assigned_id}",
  "status": "failed",
  "files_modified": [],
  "files_created": [],
  "decisions": [],
  "interfaces_defined": [],
  "warnings": [],
  "failure_reason": "agent did not produce unit-report.json"
}
```
```

- [ ] **Step 2: Commit**

```bash
git add build/engine/templates/unit-report-template.md
git commit -m "feat(ralph-loop): add unit-report.json template and schema"
```

---

### Task 12: Update build-sprint.md for dependency generation

**Files:**
- Modify: `build/commands/build-sprint.md`

- [ ] **Step 1: Read current file**

Read `build/commands/build-sprint.md` to find the task generation section.

- [ ] **Step 2: Add dependency generation requirement**

Add a section to the sprint command that instructs the planner to produce `depends_on` and `file_scope` arrays for each task. Insert after the task definition section:

```markdown
### Task Dependency and Scope Fields

Each task in `task-state.json` MUST include:

- `depends_on`: Array of task IDs that must complete before this task can start. Empty array `[]` if no dependencies. Used by `/build-execute --parallel` for DAG construction.
- `file_scope`: Array of file paths this task will create or modify. Used for tier classification and merge conflict prevention in parallel execution.

Example:
```json
{
  "id": "T-abc123",
  "title": "Add user authentication",
  "status": "pending",
  "depends_on": ["T-def456"],
  "file_scope": ["src/middleware/auth.ts", "src/middleware/auth.test.ts"],
  "description": "..."
}
```

The planner should determine dependencies by analyzing:
1. Data flow: if task B reads from a model created by task A, B depends on A
2. Interface contracts: if task B imports a type defined by task A, B depends on A
3. File overlap: if two tasks modify the same file, one must depend on the other
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-sprint.md
git commit -m "feat(ralph-loop): add dependency generation to sprint command"
```

---

## Summary

| Task | Component | Lines Added (est.) |
|------|-----------|-------------------|
| 1 | STATE_FILES entry | 1 |
| 2 | DAGBuilder | ~120 |
| 3 | dag CLI subcommands | ~25 |
| 4 | LedgerManager | ~180 |
| 5 | MergeValidator | ~35 |
| 6 | ledger + merge CLI | ~70 |
| 7 | build-execute.md parallel section | ~120 |
| 8 | execute.md parallel variant | ~40 |
| 9 | executor.md parallel constraints | ~40 |
| 10 | execution-pack.md parallel budget | ~30 |
| 11 | unit-report-template.md | ~60 |
| 12 | build-sprint.md dependencies | ~30 |
| **Total** | | **~750 lines** |

12 tasks, 12 commits. Each task is independently testable and produces a working intermediate state.
