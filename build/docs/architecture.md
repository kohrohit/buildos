# BuildOS Architecture

This document describes the 3-layer architecture that underpins BuildOS: Governance, Execution, and Context. Each layer has distinct responsibilities, lifecycle characteristics, and interaction rules.

---

## Overview

BuildOS is structured as three cooperating layers:

```
┌───────────────────────────────────────────────────────────────────┐
│                         GOVERNANCE LAYER                          │
│                                                                   │
│  Permanent. Always loaded. Quality immune system & project memory. │
│                                                                   │
│  ┌──────────┐ ┌───────┐ ┌───────┐ ┌────────┐ ┌──────────────┐   │
│  │  Agents  │ │ Rules │ │ Hooks │ │ Skills │ │    Brain     │   │
│  │          │ │       │ │       │ │        │ │ (vision,arch,│   │
│  │architect │ │naming │ │pre-   │ │analyze │ │ domain,NFRs, │   │
│  │reviewer  │ │struct │ │commit │ │refactor│ │ glossary,ADR)│   │
│  │standards │ │deps   │ │post-  │ │test    │ │              │   │
│  │          │ │secure │ │sprint │ │document│ │              │   │
│  └──────────┘ └───────┘ └───────┘ └────────┘ └──────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                          CONTEXT LAYER                            │
│                                                                   │
│  Mediator. Assembles, filters, compresses, routes context.        │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │ Loaders  │ │ Policies │ │ Context Packs│ │  Summaries    │   │
│  │          │ │          │ │              │ │               │   │
│  │planning  │ │inclusion │ │planning-pack │ │sprint-summary │   │
│  │sprint    │ │exclusion │ │sprint-pack   │ │module-summary │   │
│  │execution │ │compress  │ │exec-pack     │ │project-summary│   │
│  │review    │ │freshness │ │review-pack   │ │               │   │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                         EXECUTION LAYER                           │
│                                                                   │
│  Transient. Sprint-scoped. Produces artifacts for governance.     │
│                                                                   │
│  ┌───────────┐ ┌──────────────┐ ┌───────────┐                   │
│  │ Workflows │ │ Exec Agents  │ │ Templates │                   │
│  │           │ │              │ │           │                   │
│  │plan       │ │planner       │ │sprint-plan│                   │
│  │sprint     │ │executor      │ │task-spec  │                   │
│  │execute    │ │verifier      │ │verify-rpt │                   │
│  │verify     │ │researcher    │ │review-rpt │                   │
│  │research   │ │              │ │learn-rpt  │                   │
│  │release    │ │              │ │           │                   │
│  └───────────┘ └──────────────┘ └───────────┘                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Governance

### Purpose

The governance layer is the project's permanent memory and quality immune system. It defines what the project is, how it should be built, and what standards must be met. It is loaded into every BuildOS command invocation.

### Components

**Brain** — The project's institutional memory. Contains:
- `vision.md` — Product vision, goals, success criteria, target users.
- `architecture.md` — System boundaries, component diagram, tech stack, integration points, deployment model.
- `domain-model.md` — Core entities, their attributes, relationships, invariants, and lifecycle rules.
- `nfrs.md` — Non-functional requirements: performance targets, security requirements, accessibility standards, scalability expectations.
- `glossary.md` — Ubiquitous language. Canonical terms and their definitions. Prevents ambiguity across the project.
- `adrs/` — Architecture Decision Records. Each ADR captures a decision, its context, the options considered, and the rationale for the choice made.

**Agents** — Governance agents are always-active reviewers and enforcers:
- *Architect agent* — Validates that changes respect system boundaries, component responsibilities, and integration contracts.
- *Reviewer agent* — Inspects code for standards compliance, readability, maintainability, and consistency.
- *Standards agent* — Enforces coding conventions, naming rules, file structure, and dependency constraints.

**Rules** — Declarative constraints that agents enforce:
- Naming conventions (files, functions, variables, database columns).
- Structural rules (directory layout, module boundaries, import restrictions).
- Dependency rules (allowed/forbidden packages, version constraints).
- Security rules (no secrets in code, input validation requirements, auth checks).

**Hooks** — Quality gates triggered at lifecycle boundaries:
- *Pre-execute* — Validates that sprint tasks are properly specified before execution begins.
- *Post-execute* — Runs automated checks after each task completion.
- *Pre-review* — Ensures verification has passed before governance review starts.
- *Post-learn* — Validates that sprint summary captures all decisions and outcomes.

**Skills** — Reusable capabilities that agents can invoke:
- Code analysis (complexity, duplication, coverage).
- Refactoring patterns (extract, inline, rename, restructure).
- Documentation generation (API docs, module docs, decision logs).
- Test generation (unit, integration, contract).

### Lifecycle

Governance is permanent. It is created during `/build:init` and evolves through explicit, deliberate updates — never through silent modification by execution agents. Changes to governance artifacts require review and are tracked through ADRs.

---

## Layer 2: Execution

### Purpose

The execution layer is the production floor. It runs sprint-scoped workflows that produce code, tests, documentation, and other artifacts. It operates within boundaries set by governance and produces output that governance evaluates.

### Components

**Workflows** — Multi-step processes that execution agents follow:
- *Plan workflow* — Reads brain state, analyzes codebase, generates a prioritized roadmap of milestones and epics.
- *Sprint workflow* — Selects next priority work from roadmap, decomposes into tasks, estimates scope, sets acceptance criteria.
- *Execute workflow* — Works through sprint tasks sequentially. For each task: load context, implement, self-check against rules, mark complete.
- *Verify workflow* — Runs test suites, linting, type checking, architectural compliance validation, NFR audits.
- *Research workflow* — Investigates unknowns — API documentation, library capabilities, design pattern applicability — before execution.
- *Release workflow* — Prepares release artifacts: changelog, version bump, migration scripts, deployment notes.

**Execution Agents** — Specialized agents that operate within workflows:
- *Planner* — Analyzes the project brain and codebase to produce structured roadmaps and sprint plans.
- *Executor* — Implements tasks: writes code, tests, configurations, and documentation within governance constraints.
- *Verifier* — Runs checks and produces verification reports with pass/fail/warning for each criterion.
- *Researcher* — Gathers information needed for informed decisions: reads docs, explores APIs, evaluates libraries.

**Templates** — Structured output formats:
- Sprint plan template (tasks, estimates, acceptance criteria, dependencies).
- Task specification template (description, context, constraints, definition of done).
- Verification report template (checks run, results, issues found, recommendations).
- Review report template (standards compliance, architecture alignment, domain correctness).
- Learn report template (summary, decisions made, lessons learned, brain updates).

### Lifecycle

Execution is transient. Each sprint creates a fresh execution context. When the sprint completes and `/build:learn` runs, the execution state is compressed into a summary and archived. Future sprints do not carry forward the full execution detail — only the compressed summary.

---

## Layer 3: Context

### Purpose

The context layer is the logistics system. It ensures that every command invocation receives exactly the context it needs — relevant, fresh, appropriately compressed, and within token budget. It prevents context rot (stale data polluting decisions), context bloat (irrelevant material wasting tokens), and context starvation (missing information causing hallucination).

### Components

**Loaders** — Per-command context assembly logic:
- *Planning loader* — Loads vision, architecture, domain model, NFRs, roadmap progress, completed sprint summaries. Excludes task-level detail.
- *Sprint loader* — Loads architecture, roadmap, relevant module summaries, recent sprint summaries. Excludes unrelated modules.
- *Execution loader* — Loads current task spec, relevant rules, relevant code files, domain model subset. Excludes roadmap, other sprints, unrelated modules.
- *Review loader* — Loads governance rules, architecture, current sprint output, relevant ADRs. Excludes execution internals.

**Policies** — Rules governing context assembly:
- *Inclusion policy* — What must always be loaded: architecture overview, active sprint state, relevant rules for current scope.
- *Exclusion policy* — What must never be loaded: completed sprints older than 2 cycles, superseded ADRs, unrelated module internals.
- *Compression policy* — When to compress: sprint completion triggers sprint summary, module completion triggers module summary, milestone completion triggers milestone summary.
- *Freshness policy* — Conflict resolution: current code beats documentation when they diverge, recent state beats old summaries, explicit decisions (ADRs) beat implicit conventions.

**Context Packs** — Pre-assembled context bundles optimized for each phase:
- *Planning pack* — Brain (full), roadmap, sprint summaries (last 3), project health metrics.
- *Sprint pack* — Architecture, roadmap (current milestone), module summaries (relevant), recent sprint (last 1).
- *Execution pack* — Current task, relevant rules, relevant code, domain model (scoped), active sprint context.
- *Review pack* — Governance rules (all), architecture, sprint diff, relevant ADRs, NFRs.

**Summaries** — Compressed historical context:
- *Sprint summaries* — What was done, what was decided, what was learned. Replaces full sprint state.
- *Module summaries* — Module purpose, public API, key decisions, known issues. Replaces reading all module code.
- *Project summary* — High-level state: milestones completed, current focus, major decisions, open risks.

### Lifecycle

Context is dynamic. It is assembled fresh for each command invocation by loaders applying policies to available material. Summaries accumulate over time as sprints and modules are completed. The context layer continuously balances completeness against token budget.

---

## Interaction Rules

### Rule 1: Governance Constrains Execution

Execution agents must operate within governance boundaries. When an executor writes code, it checks against governance rules. When a planner creates a roadmap, it respects architectural boundaries. When a verifier runs checks, it uses governance criteria. Execution cannot override or circumvent governance.

### Rule 2: Execution Proposes, Governance Approves

Execution produces artifacts — code, tests, configurations, documentation. These artifacts are proposals. Governance agents review them during `/build:review`. Only after governance approval are artifacts considered accepted. If governance finds violations, execution must correct them.

### Rule 3: Execution Never Silently Modifies Governance

If execution discovers that a governance artifact needs updating (e.g., the architecture needs a new component, a rule needs an exception, the domain model needs a new entity), it must surface this as an explicit proposal. The proposal is logged, reviewed, and either accepted (creating an ADR) or rejected. Execution never quietly edits brain files or rules.

### Rule 4: Context Mediates All Interactions

Neither governance nor execution directly reads the full state. Both receive curated context assembled by the context layer. This prevents governance agents from being overwhelmed by execution detail, and prevents execution agents from being distracted by irrelevant governance material.

### Rule 5: State Flows Downward, Feedback Flows Upward

Governance state flows down through context to execution. Execution feedback flows up through context to governance. Context transforms in both directions — expanding governance rules into execution constraints on the way down, and compressing execution results into governance-relevant summaries on the way up.

---

## Data Flow

### Command Invocation Flow

```
User runs /build:execute
        │
        ▼
┌─────────────────┐
│  Command Entry  │  commands/execute.md
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Loader  │  context/loaders/execution-loader.md
│                 │
│ 1. Read policies│
│ 2. Identify     │
│    relevant     │
│    material     │
│ 3. Apply        │
│    inclusion/   │
│    exclusion    │
│ 4. Compress     │
│    if needed    │
│ 5. Assemble     │
│    context pack │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Governance    │  governance/ (rules, agents, brain)
│   Check         │
│                 │
│ Loaded into     │
│ session as      │
│ active          │
│ constraints     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Execution     │  engine/workflows/execute.md
│   Workflow      │
│                 │
│ Execute tasks   │
│ within          │
│ governance      │
│ boundaries      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  State Update   │  state/current-sprint.md, state/progress.md
│                 │
└─────────────────┘
```

### Sprint Lifecycle Data Flow

```
/build:sprint                    /build:execute
     │                                │
     ▼                                ▼
┌──────────┐                   ┌──────────────┐
│ Sprint   │                   │  Task Loop   │
│ Loader   │                   │              │
│          │                   │ For each task│
│ Loads:   │                   │  1. Load ctx │
│ -arch    │                   │  2. Execute  │
│ -roadmap │                   │  3. Self-chk │
│ -module  │                   │  4. Update   │
│  summaries                   │     state    │
└────┬─────┘                   └──────┬───────┘
     │                                │
     ▼                                ▼
┌──────────┐                   ┌──────────────┐
│ Sprint   │                   │   Verify     │
│ Plan     │──────────────────▶│              │
│          │   feeds tasks     │ Tests, lint, │
│ Tasks,   │                   │ arch checks, │
│ scope,   │                   │ NFR audits   │
│ criteria │                   └──────┬───────┘
└──────────┘                          │
                                      ▼
                               ┌──────────────┐
                               │   Review     │
                               │              │
                               │ Governance   │
                               │ agents       │
                               │ evaluate     │
                               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │   Learn      │
                               │              │
                               │ Compress     │
                               │ Archive      │
                               │ Update brain │
                               └──────────────┘
```

---

## Extension Points

Each layer is designed for extension without modification of core files.

| Layer | Extension Point | How to Extend |
|-------|----------------|---------------|
| Governance | Agents | Add files to `governance/agents/` |
| Governance | Rules | Add files to `governance/rules/` |
| Governance | Hooks | Add files to `governance/hooks/` |
| Governance | Skills | Add files to `governance/skills/` |
| Governance | Brain | Add domain-specific files to `governance/brain/` |
| Execution | Workflows | Add files to `engine/workflows/` |
| Execution | Agents | Add files to `engine/agents/` |
| Execution | Templates | Add files to `engine/templates/` |
| Context | Loaders | Add files to `context/loaders/` |
| Context | Policies | Add files to `context/policies/` |
| Context | Packs | Add files to `context/packs/` |

When adding extensions, follow the existing conventions for file naming and internal structure. New governance agents should declare their role, activation triggers, inspection scope, and available actions. New workflows should declare their steps, required context, and output format.
