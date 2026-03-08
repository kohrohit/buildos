# Context Engineering in BuildOS

Context engineering is how BuildOS manages what an AI agent sees during each operation. It is not a convenience feature — it is the mechanism that determines whether BuildOS produces coherent, grounded output or drifts into hallucination, repetition, and inconsistency.

---

## Why Context Matters

AI agents operate within a finite context window. Every token loaded is a token that could have been something else. Poor context management produces four failure modes:

**Context rot** — Stale data remains loaded after it has been superseded. The agent makes decisions based on outdated architecture, completed sprint plans, or resolved issues. Symptoms: the agent re-solves solved problems, contradicts recent decisions, or references removed code.

**Context bloat** — Irrelevant material consumes token budget. The agent receives the full roadmap when it only needs the current task, or loads all governance rules when only three are relevant. Symptoms: slow responses, generic output, failure to engage with specifics.

**Context starvation** — Critical information is missing. The agent writes code that violates architectural boundaries because the architecture file was not loaded, or creates a naming pattern that conflicts with the glossary because the glossary was excluded. Symptoms: governance violations, inconsistent naming, duplicated logic.

**Context conflict** — Contradictory information is loaded simultaneously. An old summary says "we use REST" but the current architecture says "we migrated to GraphQL." The agent gets confused and produces hybrid output. Symptoms: mixed patterns, hedging language, self-contradictory code.

BuildOS solves these through four policies (inclusion, exclusion, compression, freshness), context packs, loaders, and progressive summarization.

---

## Context Packs

Context packs are pre-assembled bundles of context optimized for specific phases of the development lifecycle. Each pack is designed to include everything needed for its phase and nothing more.

### Planning Pack

**Purpose:** Provide the planner with full strategic context to produce a well-prioritized roadmap.

**Contents:**
- Brain: vision (full), architecture (full), domain model (full), NFRs (full).
- State: roadmap (current), sprint summaries (last 3 completed sprints).
- Project: health metrics, code statistics, test coverage summary.

**Excluded:**
- Individual task specifications.
- Sprint-level execution detail.
- Code file contents.
- Superseded ADRs (only current decisions).

**Rationale:** Planning needs the big picture. It needs to understand what the project is, where it has been, and where it needs to go. It does not need implementation detail.

### Sprint Pack

**Purpose:** Provide the sprint planner with enough context to decompose the next milestone into concrete, well-scoped tasks.

**Contents:**
- Brain: architecture (full), domain model (relevant modules).
- State: roadmap (current milestone only), module summaries (relevant modules), last sprint summary.
- Rules: structural rules, dependency rules.

**Excluded:**
- Full roadmap (only current milestone).
- Older sprint summaries (only the most recent).
- Unrelated module details.
- Vision and NFRs (already factored into the roadmap).

**Rationale:** Sprint planning needs to understand the architecture and current state well enough to create actionable tasks. It does not need full strategic context.

### Execution Pack

**Purpose:** Provide the executor with precisely the context needed to implement the current task.

**Contents:**
- Current task specification (from sprint plan).
- Brain: domain model (entities relevant to this task), architecture (components relevant to this task).
- Rules: all rules applicable to the files being modified.
- Code: existing source files that the task will modify or depend on.
- State: active sprint context (current task, preceding task outcomes).

**Excluded:**
- Roadmap.
- Other sprint tasks (only the current one).
- Module summaries for unrelated modules.
- Sprint summaries from previous sprints.
- Vision, NFRs (already encoded in rules and architecture).

**Rationale:** Execution needs depth, not breadth. The executor should see the code it is changing, the rules it must follow, and the domain constraints it must respect. Everything else is noise.

### Review Pack

**Purpose:** Provide governance agents with the context needed to evaluate sprint output against standards.

**Contents:**
- Governance: all rules, all active agents, relevant ADRs.
- Brain: architecture (full), domain model (full), NFRs (full).
- State: sprint diff (all changes made during the sprint), verification results.
- Context: sprint summary (what was intended).

**Excluded:**
- Execution internals (how the executor worked through tasks).
- Previous sprint details (unless they set precedent via ADRs).
- Code files not touched during the sprint.

**Rationale:** Review needs to compare what was produced against what was expected. It needs full governance context and the specific changes, but not execution process details.

---

## Policies

### Inclusion Policy

The inclusion policy specifies what must always be loaded, regardless of the command being run or the current phase.

**Always included:**
- Architecture overview (the top-level system diagram and component list — not the full architecture document).
- Active sprint state (current sprint ID, task list with status, blockers).
- Critical rules (rules marked as `severity: critical` — e.g., security constraints, data integrity rules).
- Glossary (ensures consistent terminology across all phases).

**Conditionally included:**
- Domain model — included when the command touches business logic; excluded for infrastructure-only tasks.
- NFRs — included during verification and review; excluded during planning and execution unless the task specifically addresses an NFR.
- ADRs — included when the command touches a component that has relevant ADRs; excluded otherwise.

### Exclusion Policy

The exclusion policy specifies what must never be loaded under any circumstances.

**Always excluded:**
- Completed sprints older than 2 cycles — their content is available only through sprint summaries.
- Superseded ADRs — only the current decision is loaded; historical alternatives are archived but not loaded.
- Unrelated module internals — if a sprint touches module A and module B, module C's source code is never loaded.
- Execution logs — the step-by-step execution trace is for debugging only, never loaded into operational context.
- Temporary state — intermediate calculation results, draft plans, abandoned task attempts.

**Conditionally excluded:**
- Full source files — excluded when a module summary is available and the task does not modify that module.
- Test code — excluded during planning; included during execution and verification.
- Configuration files — excluded unless the task explicitly involves configuration changes.

### Compression Policy

The compression policy specifies when and how to compress context from detailed form to summary form.

**Trigger: Sprint Completion**
When `/build:learn` runs after a sprint, the full sprint state (task list, execution detail, verification results, review findings) is compressed into a sprint summary. The summary captures:
- What was accomplished (list of completed tasks with one-line descriptions).
- What was decided (any architectural or domain decisions made during the sprint).
- What was learned (patterns discovered, issues encountered, process improvements).
- What remains (deferred tasks, unresolved issues, known debt).

**Trigger: Module Completion**
When a module reaches a stable state (all planned work complete, tests passing, review approved), a module summary is generated:
- Module purpose and responsibility.
- Public API (exported functions, types, interfaces).
- Key internal decisions (algorithms chosen, patterns used).
- Dependencies (what this module depends on, what depends on it).
- Known limitations and planned improvements.

**Trigger: Milestone Completion**
When all sprints in a milestone are done, a milestone summary is generated:
- Milestone goals and whether they were achieved.
- Major decisions made during the milestone.
- Metrics (tasks completed, issues resolved, tests added).
- Impact on the roadmap (did priorities shift?).

**Compression format:** Summaries use a structured format with mandatory sections. They must capture all decisions (decisions are never compressed away) but may omit implementation details (how code was structured, what intermediate approaches were tried).

### Freshness Policy

The freshness policy resolves conflicts when multiple sources provide contradictory information.

**Rule 1: Code beats documentation.** If the codebase shows a pattern that contradicts the architecture document, the code is the ground truth. The architecture document should be updated, but the agent should not act on the outdated documentation.

**Rule 2: Recent state beats old summaries.** If the current sprint state contradicts a sprint summary from two cycles ago, the current state wins. Summaries are approximations; current state is exact.

**Rule 3: Explicit decisions beat implicit conventions.** An ADR that says "use UUID for all primary keys" overrides a convention observed in code where some tables use auto-increment integers. The ADR is the authoritative source.

**Rule 4: Governance beats execution.** If execution has drifted from governance (e.g., code was written that does not match the domain model), governance is the authority. The code should be corrected, not the domain model — unless the domain model itself is wrong, which requires an explicit governance update.

**Rule 5: Narrower scope beats broader scope.** A module-specific rule ("this module uses snake_case for database columns") overrides a project-wide convention ("use camelCase for all identifiers") within that module's scope.

---

## How Loaders Work

Loaders are the operational mechanism of context assembly. Each command has a dedicated loader that runs before the command's main logic.

### Loader Execution Steps

1. **Identify phase** — Determine which context pack applies (planning, sprint, execution, review).
2. **Resolve scope** — Determine which modules, rules, and brain sections are relevant to the current operation.
3. **Apply inclusion policy** — Load all mandatory context items.
4. **Apply exclusion policy** — Remove all forbidden context items.
5. **Check freshness** — For each loaded item, verify it is current. Replace stale items with fresh versions.
6. **Apply compression** — If any loaded item exceeds its allocated token budget, compress it using the appropriate summary.
7. **Assemble pack** — Combine all context items into a structured pack with clear section headers.
8. **Validate budget** — Confirm total context fits within token budget. If over budget, apply progressive compression starting with least-critical items.

### Token Budget Management

Each context pack has a target token budget:
- Planning pack: 40% of available context window.
- Sprint pack: 35% of available context window.
- Execution pack: 30% of available context window (reserves more space for code generation).
- Review pack: 45% of available context window.

When a pack exceeds its budget, the loader applies compression in priority order:
1. Compress sprint summaries (keep decisions, drop details).
2. Compress module summaries (keep API, drop internals).
3. Truncate code files (keep signatures and key logic, drop boilerplate).
4. As a last resort, reduce brain files to key points only.

---

## How Summaries Work

Summaries are BuildOS's progressive summarization system. They prevent context accumulation from overwhelming the token budget while preserving critical information.

### Progressive Summarization Principle

Information flows through three levels of detail:
1. **Full detail** — The raw artifact: sprint plan, execution log, source code, review findings.
2. **Working summary** — Structured compression: key facts, decisions, outcomes. Suitable for use in adjacent operations.
3. **Archival summary** — Minimal compression: one-line description. Used only for historical reference lists.

Information starts at full detail and compresses to working summary after the operation completes. Working summaries compress to archival summaries after 2-3 cycles of disuse.

### What Summaries Must Preserve

- **Decisions** — Every architectural, domain, or process decision. Why it was made, what alternatives were rejected.
- **Interfaces** — Public APIs, contract definitions, integration points. Other modules depend on these.
- **Invariants** — Rules that must always hold. Violations would cause correctness bugs.
- **Blockers and risks** — Unresolved issues, known limitations, deferred work.

### What Summaries May Omit

- **Implementation steps** — The sequence of code changes made to implement a feature.
- **Intermediate attempts** — Approaches tried and abandoned before finding the right solution.
- **Verbose output** — Full test run logs, linting reports, build output.
- **Routine details** — Standard boilerplate, configuration scaffolding, import statements.

### Summary Lifecycle

```
Sprint completes ──▶ Full sprint state compressed to working summary
                      (stored in build/state/sprints/sprint-N-summary.md)
                                    │
2 sprints later ───▶ Working summary compressed to archival summary
                      (one entry in build/context/summaries/project-summary.md)
                                    │
Archival summaries persist indefinitely but are never loaded into
operational context. They serve as a searchable log if an agent
needs to trace a historical decision.
```

---

## Practical Implications

### For Project Setup

Invest time in brain files during `/build:init`. Every brain file is loaded into most context packs. High-quality brain files mean high-quality context, which means high-quality output. Vague or incomplete brain files propagate errors through every operation.

### For Sprint Management

Keep sprints small. Large sprints generate large context requirements. A sprint with 15 tasks across 6 modules forces the context layer to load too much, triggering aggressive compression that may lose relevant detail.

### For Execution

Trust the context loader. If you find the executor missing context, the solution is to improve the loader or the brain files, not to manually paste information into the prompt. Manual context injection bypasses the policy system and leads to inconsistency.

### For Review

Review is the most context-heavy phase because it needs full governance context plus the sprint diff. Keep governance rules well-organized and non-redundant. Duplicate or overlapping rules waste token budget during review.
