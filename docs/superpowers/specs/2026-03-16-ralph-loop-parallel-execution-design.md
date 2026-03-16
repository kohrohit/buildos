# Ralph Loop: Wave-Based Parallel Execution for BuildOS

**Date:** 2026-03-16
**Version:** v0.3.0 feature
**Status:** Draft
**Approach:** Approach 1 — Orchestrator-in-CJS

## Overview

Ralph Loop adds opt-in wave-based parallel execution to BuildOS's `/build-execute` command. Inspired by the Ralphinho RFC pipeline pattern, it decomposes sprint tasks into a DAG, groups independent tasks into waves, dispatches them as parallel agents in isolated git worktrees, and synchronizes context between waves via an execution ledger.

### Problems Solved

- **Sequential bottleneck:** BuildOS executes tasks one at a time. Sprints with independent tasks waste time waiting in line.
- **Context divergence in parallel agents:** Naive parallelism produces conflicting code. Wave-based sync ensures agents share decisions from prior waves.
- **Failure cascading:** One failed task shouldn't block unrelated work. Isolate-and-continue keeps the sprint moving.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Activation | Opt-in via `--parallel` flag | Simple sprints don't need DAG overhead. User chooses. |
| Synchronization | Wave-based with execution ledger | Agents in same wave are independent (DAG guarantees). Between waves, full sync via merge + ledger. |
| Failure handling | Isolate and continue | Evict failed unit, snapshot state, recalculate DAG, continue unaffected work. |
| Minimum task count | None (user decides) | Since it's opt-in, no second gate. Warning shown if no parallelism found. |
| File conflicts | Hard fail (DAG bug) | Same file in 2+ units means missing dependency. Fix the DAG, don't paper over it. |
| Ledger storage | Cumulative file + per-wave snapshots | Agents read one file; debugging gets full wave history. |
| Implementation location | build-tools.cjs | DAG building and merge validation are deterministic algorithms. Keep them in code, not agent prompts. |

---

## 0. Prerequisites: Task Dependency Model

### Where `depends_on` comes from

The `/build-sprint` command is responsible for producing task dependencies. When defining sprint tasks, the planner agent analyzes file scopes and logical ordering to populate a `depends_on` array on each task in `state/task-state.json`.

**Modified task schema in task-state.json:**

```json
{
  "tasks": [
    {
      "id": "T1",
      "title": "Create user model",
      "status": "pending",
      "depends_on": [],
      "file_scope": ["src/models/user.ts"],
      "description": "..."
    },
    {
      "id": "T2",
      "title": "Add auth middleware",
      "status": "pending",
      "depends_on": ["T1"],
      "file_scope": ["src/middleware/auth.ts"],
      "description": "..."
    }
  ]
}
```

**Source of truth:** `state/task-state.json` holds the structured task objects with `id`, `depends_on`, `file_scope`, `wave`, and `tier` fields. `state/sprint-state.json` holds sprint-level metadata (sprint id, status, progress) and references tasks by id. Both files must stay consistent — the orchestrator reads tasks from task-state.json and updates sprint progress in sprint-state.json.

**Implication for /build-sprint:** The sprint command must be updated to produce `depends_on` and `file_scope` arrays for each task. This is an additional modified file (see Section 7).

---

## 1. New Components in build-tools.cjs

Three new managers added to the existing file:

### DAGBuilder

Takes sprint tasks with `depends_on` fields, builds an adjacency graph, validates (no cycles, no missing refs), and groups tasks into waves via topological sort.

```
Input:  tasks = [
  {id: "T1", depends_on: []},
  {id: "T2", depends_on: []},
  {id: "T3", depends_on: ["T1"]},
  {id: "T4", depends_on: ["T1", "T2"]},
  {id: "T5", depends_on: ["T3", "T4"]}
]

Output: {
  waves: [
    { id: 1, units: ["T1", "T2"] },
    { id: 2, units: ["T3", "T4"] },
    { id: 3, units: ["T5"] }
  ],
  parallelizable: true,
  max_concurrency: 2
}
```

**Cycle detection:** Kahn's algorithm. If the queue empties before all nodes are processed, a cycle exists. Report the cycle path in the error.

**Wave grouping:** After topological sort, assign each task to the wave number equal to the longest path from any root to that task. Tasks at the same depth are independent and parallelizable.

### LedgerManager

Reads/writes `state/execution-ledger.json` and `state/waves/wave-N.json`.

Methods:
- `init(sprintId)` — create empty ledger and waves directory
- `appendDecision(wave, unitId, decision)` — add decision entry
- `appendInterface(wave, unitId, iface)` — add interface entry
- `appendWarning(wave, unitId, warning)` — add warning entry
- `appendFailure(unitId, wave, reason, downstream)` — record failed unit (snapshot path computed internally)
- `snapshotFailure(waveId, unitId, failureData)` — write failure snapshot file to state/waves/
- `snapshotWave(waveId, results)` — save wave-N.json
- `getCumulativeLedger(tokenBudget)` — return ledger, compressed if over budget (waves older than 2 get one-line summaries)
- `finalize()` — generate final execution report text
- `cleanup()` — remove ledger and waves directory (called on sprint complete)

**Token budget:** 800 tokens for ledger content. Waves older than 2 completed waves get compressed to one-line summaries. Only the latest 2 waves retain full decision/interface detail.

**Cleanup timing:** `cleanup()` is called by `/build-verify` after sprint verification passes (not by the execute command). Wave snapshot files in `state/waves/` are preserved until explicit cleanup — they're useful for `/build-review` and `/build-learn`. The `ledger finalize` command generates the report but does NOT delete files.

### MergeValidator

After a wave completes, collects the **union of `files_modified` and `files_created`** from each unit's report. If any file path appears in 2+ units (whether modified or created), hard fail with actionable error.

```
✗ Wave 2 merge conflict: units T3 and T5 both modified src/types.ts
  This indicates a missing dependency in the task graph.
  Fix: Add dependency between tasks T3 → T5 (or reverse)
  Then re-run /build-execute --parallel
```

---

## 2. State Schema

### New: state/execution-ledger.json

```json
{
  "sprint_id": "S-abc123",
  "mode": "parallel",
  "current_wave": 2,
  "waves_completed": [1],
  "decisions": [
    {
      "wave": 1,
      "unit_id": "T1",
      "type": "decision",
      "description": "Used Repository pattern for data layer",
      "files_affected": ["src/repo.ts"],
      "timestamp": "2026-03-16T10:00:00Z"
    }
  ],
  "interfaces_defined": [
    {
      "wave": 1,
      "unit_id": "T1",
      "name": "UserRepository",
      "file": "src/types.ts",
      "exports": ["UserRepository", "UserDTO"]
    }
  ],
  "warnings": [],
  "failed_units": [
    {
      "unit_id": "T4",
      "wave": 2,
      "reason": "Test timeout on integration suite",
      "snapshot_path": "state/waves/wave-2-T4-snapshot.json",
      "downstream_blocked": ["T7"]
    }
  ]
}
```

### New: state/waves/ directory

```
state/waves/
├── wave-1.json              # snapshot of wave 1 results
├── wave-2.json              # snapshot of wave 2 results
└── wave-2-T4-snapshot.json  # failure snapshot for evicted unit
```

**Failure snapshot schema:**

```json
{
  "unit_id": "T4",
  "wave": 2,
  "failure_reason": "test timeout on integration suite",
  "partial_work": {
    "files_modified": ["src/orders/service.ts"],
    "files_created": ["src/orders/service.test.ts"],
    "branch": "worktree/wave-2-T4"
  },
  "worktree_preserved": true,
  "downstream_blocked": ["T7", "T8"],
  "retry_hint": "Narrow scope: split T4 into T4a (service logic) and T4b (integration test)"
}
```

### Modified: state/task-state.json

Each task gets two new optional fields (only populated in --parallel mode):

```json
{
  "wave": 1,
  "tier": 1
}
```

Existing sequential execution ignores these fields.

---

## 3. Execution Flow

```
User runs: /build-execute --parallel
                │
                ▼
    ┌─────────────────────┐
    │ 1. Load sprint tasks │
    │    + dependencies    │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ 2. DAGBuilder.build()│──→ cycle? → ABORT
    │    Topological sort  │──→ no parallelism? → WARNING, fallback sequential
    │    Group into waves  │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ 3. Classify tiers   │
    │    per unit          │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ 4. Show wave plan   │
    │    + cost estimate   │
    │    User confirms y/n │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ 5. Initialize ledger │
    └──────────┬──────────┘
               │
               ▼
  ╔═══════════════════════════╗
  ║   WAVE LOOP               ║
  ║                           ║
  ║  6. For each unit in wave:║
  ║     → Assemble context    ║
  ║     → Spawn Agent with    ║
  ║       isolation:"worktree"║
  ║     (all dispatched       ║
  ║      together in parallel)║
  ║                           ║
  ║  7. Collect results       ║
  ║     → Read unit-report.json║
  ║       from each worktree  ║
  ║                           ║
  ║  8. MergeValidator.check()║
  ║     → File conflict?      ║
  ║       HARD FAIL wave      ║
  ║                           ║
  ║  9. Handle failures       ║
  ║     → Evict failed units  ║
  ║     → Snapshot state      ║
  ║     → Block downstream    ║
  ║     → Recalculate DAG     ║
  ║                           ║
  ║ 10. Merge worktree        ║
  ║     branches into sprint  ║
  ║     branch (sequential)   ║
  ║                           ║
  ║ 11. Update ledger         ║
  ║     → Append decisions    ║
  ║     → Save wave snapshot  ║
  ║     → Advance current_wave║
  ║                           ║
  ║ 12. More waves? → repeat  ║
  ╚═══════════════════════════╝
               │
               ▼
    ┌─────────────────────┐
    │ 13. Final report     │
    └─────────────────────┘
```

### Context Assembly per Unit (Step 6)

Each agent receives:
- **Task spec** — its specific task from state/tasks/ (narrow)
- **Execution pack governance** — coding rules, architecture slice (identical for all units, read-only)
- **Cumulative ledger** — decisions, interfaces, warnings from all prior waves (shared context)
- **Tier-specific guidance** — Tier 3 units get specialist reviewer guidance (security-reviewer for auth tasks, etc.)

**Parallel mode token budget (per unit):**

| Layer | Sequential Budget | Parallel Budget | Change |
|-------|------------------|-----------------|--------|
| Sprint (filtered) | 800 | 500 | Reduced — only this unit's task, not full queue |
| Module (deep) | 1500 | 1500 | Unchanged |
| Rules | 1000 | 1000 | Unchanged |
| Governance (minimal) | 500 | 500 | Unchanged |
| Additional | 500 | 300 | Reduced |
| **Ledger** | **—** | **800** | **New — cumulative decisions from prior waves** |
| **Total** | **4300** | **4600** | +300 tokens |
| **Hard ceiling** | **5500** | **5800** | +300 tokens |

The ledger's 800 tokens are additive but offset by reducing sprint-filtered (fewer tasks loaded) and additional context (cross-module refs handled by ledger instead).

### Concurrency Cap (Step 6)

Default maximum: **4 concurrent agents** per wave. If a wave has more units than the cap, the wave is split into sub-batches dispatched sequentially within the wave (but still parallel within each sub-batch).

Configurable via `--max-agents N` flag: `/build-execute --parallel --max-agents 6`

The `max_concurrency` value from DAGBuilder output is informational only — it reports the theoretical maximum, not the enforced limit.

### Worktree Lifecycle

**Creation:** The Claude Code `Agent(isolation: "worktree")` call handles worktree creation automatically. The orchestrator does not call `git worktree add` directly — the Agent tool manages this.

**Successful units:** After the orchestrator merges a unit's branch into the sprint branch, the worktree is cleaned up automatically by the Agent tool. The branch reference is deleted after merge.

**Failed units:** The worktree branch is preserved (NOT deleted). The failure snapshot records the branch name (e.g., `worktree/wave-2-T4`). The user can inspect, fix, or retry manually. These preserved branches are cleaned up when the user explicitly runs cleanup or starts a new sprint.

### Merge Mechanics (Step 10)

Each worktree agent commits its work on a worktree branch (e.g., `worktree/wave-2-T3`). The orchestrator:
1. Runs MergeValidator pre-check on file lists (step 8)
2. Merges each passing unit's branch into the sprint branch **in task-ID order** within the wave (deterministic, reproducible history)
3. Since hard-fail-on-same-file guarantees no file overlap, merges are always clean

---

## 4. Tier Classification

Deterministic heuristic based on task spec content:

| Signal | Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|--------|
| Files in scope | 1-2 | 3-6 | 7+ OR keyword match |
| Cross-module | No | Maybe | Yes |
| Keywords | `add`, `update`, `refactor` | `integrate`, `connect`, `extend` | `migrate`, `auth`, `schema`, `security`, `perf` |
| Test scope | Unit only | Unit + integration | Unit + integration + E2E |
| Agent model | Sonnet | Sonnet | Opus |

**Keyword override:** If a task description contains `schema`, `auth`, `security`, `migration`, or `performance` — Tier 3 regardless of file count.

### Cost Confirmation

Before execution starts, the wave plan is shown with cost visibility:

```
Wave Plan:
  Wave 1: T1 (Tier 1, Sonnet), T2 (Tier 1, Sonnet)
  Wave 2: T3 (Tier 3, Opus), T4 (Tier 2, Sonnet)
  Wave 3: T5 (Tier 3, Opus)

  Estimated cost: ~2.1x sequential (3 waves vs 5 sequential tasks)
  Opus units: 2 of 5

  Proceed? (y/n)
```

---

## 5. Command Interface

### Usage

```
/build-execute              → sequential (unchanged)
/build-execute --parallel   → Ralph Loop wave-based execution
```

### New CLI Subcommands in build-tools.cjs

| Command | Purpose | Output |
|---------|---------|--------|
| `dag build` | Build DAG, topological sort into waves | JSON: waves, max_concurrency, parallelizable |
| `dag tier` | Classify each unit (1/2/3) by heuristic | JSON: unit tiers |
| `dag recalculate` | Recompute waves after failure (remove failed + blocked) | JSON: updated waves |
| `ledger init` | Create empty execution-ledger.json + state/waves/ | — |
| `ledger read` | Return cumulative ledger (compressed if over 800 tokens) | JSON: ledger |
| `ledger update <wave>` | Append wave results, save snapshot, advance wave | — |
| `ledger finalize` | Generate final report, optionally cleanup | Report text |
| `merge validate <wave> [reports.json]` | Check file lists across units for conflicts (reads wave snapshot, or optional file override) | PASS or FAIL |

### Agent Prompt Template

Each dispatched unit agent receives:

```
You are executing unit {unit_id} of sprint {sprint_id}, wave {wave_number}.

## Your Task
{task object extracted from state/task-state.json for this unit_id}

## Governance Rules
{standard execution pack governance — identical for all units}

## Context from Prior Waves
{cumulative ledger — decisions, interfaces, warnings}

## Tier: {1|2|3}
{tier-specific instructions}

## Critical Constraints (Parallel Mode)
- You MUST NOT write to sprint-state.json or task-state.json. All shared state
  updates are handled by the orchestrator after wave completion.
- You MUST NOT modify files outside your task's declared file_scope.
- You MUST write unit-report.json before your session ends (see below).

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

**Missing report fallback:** If the orchestrator cannot find unit-report.json after
an agent completes (hard crash, timeout), the unit is treated as failed with reason
"agent did not produce unit-report.json". The worktree is preserved for inspection.
```

---

## 6. Error Handling & Recovery

### Category 1: Pre-execution failures

| Failure | Response |
|---------|----------|
| Cycle in dependencies | Abort with cycle path. No state modified. |
| No active sprint | Abort. Suggest `/build-sprint`. |
| No pending tasks | Abort. Nothing to execute. |
| No parallelism found | Warning. Auto-fallback to sequential. |
| User declines cost confirmation | Cancel. Suggest sequential mode. |

### Category 2: Unit failures during a wave

Isolate-and-continue:
1. Read failed unit's `unit-report.json`
2. Snapshot worktree state to `state/waves/wave-N-UNIT-snapshot.json`
3. Preserve worktree branch (not deleted)
4. Merge passing units from the wave
5. Mark failed unit as `failed` in task-state.json
6. Find and mark all downstream dependents as `blocked_by_failure`
7. Recalculate DAG without failed + blocked tasks
8. Continue with remaining waves

### Category 3: Merge failures

| Failure | Response |
|---------|----------|
| File conflict (same file in 2+ units) | Hard fail wave. No diffs applied. Report DAG fix needed. |
| Git merge error (defensive) | Hard fail wave. Preserve all worktree branches. |
| Ledger write error | Pause execution. Preserve worktrees. User resumes after fix. |

### Resume

No new command needed. Running `/build-execute --parallel` again after failures:
- Completed tasks: skipped (already `complete`)
- Failed tasks: skipped (marked `failed`)
- Blocked tasks: skipped (marked `blocked_by_failure`)
- DAGBuilder builds waves from remaining `pending` tasks only

```
Execution Report:
  Waves completed: 2 of 3
  Units passed: 4 of 6
  Units failed: 1 (T4 — test timeout)
  Units blocked: 1 (T7 — depends on T4)

  Options:
  → /build-execute --parallel    Resume remaining waves
  → /build-execute               Switch to sequential for remaining
  → Fix T4 manually              Worktree preserved at worktree/wave-2-T4
```

---

## 7. Files Changed / Created

### Modified

| File | Change |
|------|--------|
| `build/bin/build-tools.cjs` | +DAGBuilder, LedgerManager, MergeValidator, tier classifier, CLI subcommands (~350-400 lines) |
| `build/commands/build-execute.md` | +Parallel Mode section with wave dispatch instructions and agent prompt template |
| `build/commands/build-sprint.md` | +Task dependency generation: planner must produce `depends_on` and `file_scope` arrays per task |
| `build/engine/workflows/execute.md` | +Parallel Execution Variant section |
| `build/engine/agents/executor.md` | +Parallel Mode Constraints: must not write shared state (sprint-state.json, task-state.json), must produce unit-report.json, scope limits |
| `build/context/templates/execution-pack.md` | +Parallel Mode token budget table (4600/5800 ceiling), ledger inclusion, tier-specific loading |

### New

| File | Purpose |
|------|---------|
| `build/state/execution-ledger.json` | Cumulative ledger (created by init, cleaned on sprint complete) |
| `build/state/waves/` | Per-wave snapshots and failure snapshots |
| `build/engine/templates/unit-report-template.md` | Documents unit-report.json schema |

### Unchanged

| File | Reason |
|------|--------|
| `build/governance/*` | Read-only during execution |
| `build/learning/*` | Post-sprint concern, unaffected |
| `build/context/policies/*` | Existing policies apply; ledger is an addition |
| Sequential `/build-execute` | Zero changes when `--parallel` absent |

---

## 8. Follow-Up Hardening (Post-v0.3.0)

Items identified during spec review that are non-blocking but worth addressing after initial implementation:

1. **file_scope enforcement:** Add a post-wave validation step in the orchestrator that compares each unit's `files_modified + files_created` against its declared `file_scope`. Reject units that touched out-of-scope files before merge. Currently enforcement is agent-prompt-only (honor system).

2. **Merge conflict recovery path:** Category 3 merge failures (file conflict = DAG bug) currently require the user to fix dependencies and re-run. Consider adding a `dag suggest-fix` command that analyzes the conflict and proposes which task should depend on the other.

3. **Sub-batch ordering within waves:** When a wave exceeds `--max-agents` and is split into sub-batches, units are assigned to sub-batches in task-ID order. Sub-batch 2 agents do NOT see sub-batch 1 results (they're in the same wave, so no inter-unit dependency). All sub-batches within a wave are merged together at wave end.
