# BuildOS Command Reference

Complete reference for all BuildOS commands. Each entry documents purpose, syntax, arguments, context loading behavior, governance checks, state updates, output, and examples.

---

## /build:init

### Purpose

Initialize BuildOS for a project. Creates the project brain, scans the existing codebase for structure and conventions, and sets up state tracking.

### Syntax

```
/build:init [--from-existing] [--minimal]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--from-existing` | Scan the existing codebase and pre-populate brain files with detected architecture, domain entities, and conventions. Default behavior when source files are detected. |
| `--minimal` | Create brain file templates without codebase scanning. Useful for greenfield projects. |

### Context Loaded

- None (this is the bootstrap command).
- If `--from-existing`: scans project directory structure, package manifests, configuration files, and source file patterns.

### Governance Checks

- None (governance does not yet exist).

### State Updated

- Creates `build/governance/brain/vision.md` with template or detected content.
- Creates `build/governance/brain/architecture.md` with template or detected stack and structure.
- Creates `build/governance/brain/domain-model.md` with template or detected entities.
- Creates `build/governance/brain/nfrs.md` with template.
- Creates `build/governance/brain/glossary.md` with template or detected terms.
- Creates `build/governance/brain/adrs/` directory.
- Creates `build/state/progress.md` with initial state.

### Output

Summary of created files, detected project characteristics (if `--from-existing`), and next steps.

### Examples

```
# Initialize with codebase scanning (default)
/build:init

# Initialize for a new project with no existing code
/build:init --minimal

# Initialize and scan an existing Node.js project
/build:init --from-existing
```

---

## /build:plan

### Purpose

Generate or update the project roadmap. Analyzes the project brain, current codebase state, and sprint history to produce a prioritized sequence of milestones and epics.

### Syntax

```
/build:plan [--refresh] [--horizon <sprints>]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--refresh` | Regenerate the roadmap from scratch, discarding the existing one. Without this flag, the planner updates the existing roadmap. |
| `--horizon <sprints>` | How far ahead to plan, in sprints. Default: 10. |

### Context Loaded

Planning context pack:
- Brain: vision (full), architecture (full), domain model (full), NFRs (full).
- State: existing roadmap (if updating), sprint summaries (last 3), progress metrics.
- Codebase: directory structure, module list, test coverage summary.

### Governance Checks

- Architecture agent validates that proposed milestones respect system boundaries.
- Standards agent validates that the roadmap follows the milestone/epic structure format.

### State Updated

- Creates or updates `build/state/roadmap.md`.
- Updates `build/state/progress.md` with planning timestamp and roadmap hash.

### Output

The complete roadmap displayed in the session, with milestones listed in priority order. Each milestone includes:
- Name and description.
- Epics within the milestone.
- Estimated scope (sprint count).
- Dependencies on other milestones.
- Risk assessment.

### Examples

```
# Generate initial roadmap
/build:plan

# Regenerate roadmap after major requirement change
/build:plan --refresh

# Plan only the next 5 sprints
/build:plan --horizon 5
```

---

## /build:sprint

### Purpose

Create a sprint plan by selecting the next highest-priority work from the roadmap and decomposing it into concrete, implementable tasks.

### Syntax

```
/build:sprint [--milestone <name>] [--size <small|medium|large>]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--milestone <name>` | Override automatic selection and plan a sprint for a specific milestone. |
| `--size <small\|medium\|large>` | Sprint size. Small: 3-5 tasks. Medium: 5-8 tasks. Large: 8-12 tasks. Default: medium. |

### Context Loaded

Sprint context pack:
- Brain: architecture (full), domain model (relevant modules).
- State: roadmap (current milestone), module summaries (relevant), last sprint summary.
- Rules: structural rules, dependency constraints.
- Codebase: module structure for relevant components.

### Governance Checks

- Architecture agent validates that tasks respect module boundaries and component responsibilities.
- Standards agent validates that task specifications include required fields (description, acceptance criteria, scope boundaries).

### State Updated

- Creates `build/state/current-sprint.md` with sprint plan.
- Updates `build/state/roadmap.md` to mark selected work as "in sprint."
- Updates `build/state/progress.md` with sprint start timestamp.

### Output

The sprint plan displayed in the session. Each task includes:
- Task ID and title.
- Description (what to do).
- Acceptance criteria (how to know it is done).
- Scope boundaries (what is in scope, what is not).
- Dependencies (other tasks that must complete first).
- Relevant files (source files likely to be modified).
- Applicable rules (governance rules relevant to this task).

### Examples

```
# Auto-select next priority work, medium sprint
/build:sprint

# Plan a sprint for a specific milestone
/build:sprint --milestone "Authentication System"

# Plan a small sprint for focused work
/build:sprint --size small
```

---

## /build:execute

### Purpose

Execute the current sprint by working through tasks sequentially. For each task, the executor loads relevant context, implements the change, self-checks against governance rules, and updates state.

### Syntax

```
/build:execute [--task <id>] [--dry-run]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--task <id>` | Execute only a specific task instead of running through all remaining tasks. |
| `--dry-run` | Show what would be done for each task without making changes. Useful for validating the sprint plan before committing to execution. |

### Context Loaded

Execution context pack (loaded per-task):
- Current task specification.
- Brain: domain model (entities relevant to this task), architecture (components relevant to this task).
- Rules: all rules applicable to files being modified.
- Code: existing source files the task will modify or depend on.
- State: active sprint context, outcomes of preceding tasks in this sprint.

### Governance Checks

Per-task governance checks:
- Pre-execute hook validates task specification completeness.
- During execution, rules are checked against generated code in real time.
- Post-execute hook validates that the task output matches acceptance criteria.
- Standards agent checks naming, structure, and convention compliance.

### State Updated

Per-task state updates:
- Updates task status in `build/state/current-sprint.md` (pending -> in_progress -> done | blocked).
- Logs task outcome in `build/state/progress.md`.
- Records any governance violations encountered and resolved.

### Output

Per-task output:
- Files created or modified (with summary of changes).
- Governance checks passed/failed.
- Task status update.

Sprint-level output on completion:
- Summary of all tasks completed.
- List of any blocked or deferred tasks.
- Recommendation to run `/build:verify`.

### Examples

```
# Execute all remaining tasks in the current sprint
/build:execute

# Execute a specific task
/build:execute --task T3

# Preview execution plan without making changes
/build:execute --dry-run
```

---

## /build:verify

### Purpose

Run verification checks against the current sprint output. Validates that code is correct, tests pass, conventions are followed, architecture is respected, and non-functional requirements are met.

### Syntax

```
/build:verify [--scope <full|changed>] [--fix]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--scope <full\|changed>` | Verify the full codebase or only files changed in the current sprint. Default: changed. |
| `--fix` | Automatically fix issues that have deterministic solutions (formatting, import ordering, simple lint violations). |

### Context Loaded

Verification context:
- Rules: all governance rules.
- Brain: architecture (full), NFRs (full).
- State: current sprint (task list, files changed).
- Code: files changed during the sprint, plus their test files.

### Governance Checks

Verification is itself a governance check. It runs:
- Test execution (all test suites covering changed code).
- Linting (configured linters for the project's languages).
- Type checking (if the project uses a typed language).
- Architecture compliance (import boundaries, dependency direction, component responsibilities).
- NFR audit (measurable requirements: response time benchmarks, bundle size limits, coverage thresholds).
- Domain invariant validation (do code-level constraints match domain model invariants?).

### State Updated

- Creates `build/state/sprints/sprint-N-verify.md` with verification results.
- Updates `build/state/progress.md` with verification status and timestamp.
- If `--fix` is used, modifies source files to resolve fixable issues.

### Output

Structured verification report:
- Section per check category (tests, lint, types, architecture, NFRs, domain).
- Each item marked PASS, FAIL, or WARN.
- For FAIL items: description, location, suggested fix.
- Summary: total checks, pass count, fail count, warning count.

### Examples

```
# Verify files changed in the current sprint
/build:verify

# Verify the full codebase
/build:verify --scope full

# Verify and auto-fix formatting issues
/build:verify --fix
```

---

## /build:review

### Purpose

Run a governance review of the current sprint output. Governance agents evaluate all changes against standards, architectural rules, domain correctness, and NFR compliance. This is a qualitative review, complementing the quantitative checks of `/build:verify`.

### Syntax

```
/build:review [--focus <area>]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--focus <area>` | Focus the review on a specific area: `standards`, `architecture`, `domain`, `security`, `performance`. Without this flag, all areas are reviewed. |

### Context Loaded

Review context pack:
- Governance: all rules, all active agent definitions, relevant ADRs.
- Brain: architecture (full), domain model (full), NFRs (full), glossary.
- State: sprint diff (all changes made), verification results.
- Context: sprint plan (intended scope and acceptance criteria).

### Governance Checks

This command is the governance check. It invokes:
- Standards agent: naming conventions, code organization, documentation completeness, error handling patterns.
- Architecture agent: boundary violations, dependency direction, component coupling, interface contracts.
- Domain agent: entity correctness, relationship integrity, invariant enforcement, lifecycle compliance.
- Security agent (if configured): authentication checks, authorization enforcement, input validation, data protection.

### State Updated

- Creates `build/state/sprints/sprint-N-review.md` with review findings.
- Updates `build/state/progress.md` with review status and timestamp.
- If issues are found, updates `build/state/current-sprint.md` with remediation tasks.

### Output

Structured review report:
- Section per governance area.
- Each finding rated: APPROVED, CONCERN (acceptable but suboptimal), VIOLATION (must be fixed).
- For each finding: description, affected files, specific line references, recommended action.
- Overall verdict: APPROVED, APPROVED_WITH_CONCERNS, or CHANGES_REQUIRED.

### Examples

```
# Full governance review
/build:review

# Review only architectural compliance
/build:review --focus architecture

# Review only security aspects
/build:review --focus security
```

---

## /build:learn

### Purpose

Perform end-of-sprint learning. Compress the sprint into a summary, extract lessons learned, propose brain updates, and archive sprint state. This is how BuildOS prevents context rot and maintains institutional memory.

### Syntax

```
/build:learn [--no-brain-update]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--no-brain-update` | Skip brain update proposals. Only compress and archive. Useful when you want to manually review brain changes. |

### Context Loaded

Learn context:
- State: full current sprint (tasks, execution outcomes, verification results, review findings).
- Brain: all brain files (to identify what might need updating).
- Context: previous sprint summaries (to maintain consistency in summary format).

### Governance Checks

- Post-learn hook validates that the summary captures all decisions made during the sprint.
- Standards agent validates summary format and completeness.
- If brain updates are proposed, architecture and domain agents validate that updates are consistent with existing brain content.

### State Updated

- Creates `build/state/sprints/sprint-N-summary.md` with compressed sprint summary.
- Archives sprint detail files to `build/state/sprints/`.
- Resets `build/state/current-sprint.md` to empty (ready for next sprint).
- Updates `build/state/progress.md` with sprint completion and metrics.
- If brain updates are accepted: modifies relevant files in `build/governance/brain/`.
- If new ADRs are proposed: creates entries in `build/governance/brain/adrs/`.

### Output

- Sprint summary (displayed in session).
- List of brain update proposals (if any), each with rationale.
- Metrics: tasks completed, issues found/resolved, decisions made, time elapsed.
- Recommendation for next action (next sprint or re-plan).

### Examples

```
# Full learn cycle with brain update proposals
/build:learn

# Learn without proposing brain changes
/build:learn --no-brain-update
```

---

## /build:status

### Purpose

Display the current state of the project. Shows sprint progress, roadmap status, recent verification and review results, and project health metrics. This is a read-only command that does not modify any state.

### Syntax

```
/build:status [--detail <section>]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--detail <section>` | Show expanded detail for a specific section: `sprint`, `roadmap`, `verification`, `review`, `health`. Without this flag, all sections are shown in summary form. |

### Context Loaded

Minimal context:
- State: current sprint status, roadmap progress, latest verification results, latest review findings.
- Progress metrics.
- No brain files, no rules, no code. This command reads only state files.

### Governance Checks

None. This is a read-only command.

### State Updated

None. This is a read-only command.

### Output

Dashboard-style output with sections:

**Sprint Status**
- Sprint ID and name.
- Tasks: done / in-progress / remaining / blocked.
- Current task (if execution is in progress).
- Blockers (if any).

**Roadmap Progress**
- Milestones: completed / current / remaining.
- Current milestone name and progress percentage.
- Estimated sprints remaining.

**Recent Verification**
- Last verification timestamp.
- Result: pass / fail count.
- Outstanding issues (if any).

**Recent Review**
- Last review timestamp.
- Verdict: APPROVED / CONCERNS / CHANGES_REQUIRED.
- Outstanding findings (if any).

**Project Health**
- Sprint velocity (tasks per sprint, trend).
- Governance compliance rate (review pass rate).
- Context efficiency (average context load size, compression ratio).
- Brain freshness (last update timestamp for each brain file).

### Examples

```
# Show full status dashboard
/build:status

# Show detailed sprint information
/build:status --detail sprint

# Show detailed roadmap with all milestones
/build:status --detail roadmap

# Show health metrics and trends
/build:status --detail health
```
