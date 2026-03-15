# BuildOS

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Platform](https://img.shields.io/badge/platform-Claude%20Code-purple)
![Status](https://img.shields.io/badge/status-beta-orange)

**The operating system for AI-powered software development.**

BuildOS turns Claude Code into a structured software factory. It enforces coding standards, manages project memory, plans and executes work in sprints, prevents context rot, and learns from every cycle — all through a single `/build:*` command interface.

---

## Why BuildOS

AI coding assistants are powerful but undirected. Without structure, they produce inconsistent code, forget architectural decisions between sessions, waste tokens loading irrelevant context, and drift from the original design as projects grow.

BuildOS fixes this with three capabilities working together:

**1. Permanent Project Memory** — Your architecture, standards, domain model, and decisions persist across every session. Nothing gets forgotten.

**2. Structured Execution** — Work is planned into sprints, executed task-by-task, verified against acceptance criteria, and reviewed against your standards. No wandering.

**3. Intelligent Context Management** — Each command loads only the context it needs. Completed work is compressed into summaries. Stale data is excluded. Token budgets are respected.

---

## Features

### Project Brain
A persistent knowledge base that holds your project's truth:
- **Vision** — what you're building and why
- **Architecture** — system design, tech stack, module boundaries, integration patterns
- **Domain Model** — entities, relationships, aggregates, invariants
- **Non-Functional Requirements** — performance targets, security constraints, scalability needs
- **Glossary** — ubiquitous language so every agent uses the same terms
- **Architecture Decision Records** — every significant decision documented with context and rationale

### Specialist Agents
Purpose-built agents that bring expert perspectives to your project. Agents are **model-routed** for cost efficiency without quality loss:

| Agent | Role | Model |
|-------|------|-------|
| **Architect** | System design, scalability analysis, technology decisions | Opus |
| **Security Reviewer** | OWASP top 10, auth flows, secrets management, PII handling | Opus |
| **Backend Engineer** | API design, database patterns, service architecture | Opus |
| **Code Reviewer** | Clean code, SOLID principles, complexity, test coverage | Sonnet |
| **QA Verifier** | Test strategy, acceptance criteria validation, regression checks | Sonnet |
| **Documentation Writer** | API docs, runbooks, architecture docs, decision records | Sonnet |
| **Platform Engineer** | CI/CD, Docker, deployment, monitoring, infrastructure | Sonnet |

High-stakes decisions (architecture, security, production code) use Opus. Structured checklist work (code review, QA, docs) uses Sonnet — same quality, ~35% lower cost.

### Coding Standards Enforcement
Built-in rules for multiple languages and frameworks:
- **Global** — universal engineering discipline (naming, testing, security, performance)
- **Java / Spring Boot** — layered architecture, constructor injection, JPA patterns
- **Python** — FastAPI/Django structure, async patterns, Pydantic validation, pytest
- **TypeScript** — strict mode, Zod validation, module architecture
- **React** — Next.js App Router, Server Components, state management, Core Web Vitals

Add your own rules by dropping a markdown file into `governance/rules/`.

### Unbiased Isolated Reviews (v0.2.0)
Review agents are spawned in **separate worktrees with zero knowledge** of the execution session. This eliminates self-review bias — the same brain that wrote the code cannot grade its own exam.

- **Blind review context pack** — strips implementation reasoning, mid-sprint decisions, and commit messages. Reviewers see only the spec and the code.
- **Independence Mandate** — every reviewer is explicitly instructed: *"You have no knowledge of how or why this code was written. Your job is to find what is wrong, not to confirm what is right."*
- **Cross-agent escalation** — if 2+ agents flag the same area, it's auto-elevated to a blocker regardless of individual severity.

### Architecture Discovery (v0.2.0)
Before any epic is defined, `/build-plan` runs a mandatory architecture discovery phase:

1. **Classify system grade** — PoC, MVP, Production, Enterprise, or Mission-Critical
2. **Ask grade-appropriate questions** — PoC gets 4 questions, Enterprise gets 21, Mission-Critical gets 27
3. **Provide opinionated recommendations** — challenges assumptions, suggests patterns grounded in DDIA, SRE, Building Microservices principles
4. **Auto-populate NFRs** — sensible defaults per grade (uptime SLAs, latency targets, security posture)
5. **Generate architecture artifacts** — populates `architecture.md`, `nfrs.md`, and creates the first ADR

Architecture then acts as a **guardrail at every subsequent stage** — sprint definition, execution, verification, and review all enforce conformance.

### Token & Cost Optimization (v0.2.0)
Every token is treated as currency:

- **Token accounting** — hard budget ceilings per context pack, priority-based dropping when exceeded, transparent logging of what was dropped and why
- **Session-level caching** — governance rules and coding standards loaded once per session, reused across commands
- **Optimized hooks** — full governance reminder only on first tool call, silent after. Post-edit hook removed. Progress reported every 5th call, not every call.
- **Model routing** — Opus for judgment-heavy decisions, Sonnet for structured checklist work (~35% agent cost savings)

### Quality Hooks
Automated checks that run at key moments:
- **Pre-task** — validates task definition, loads relevant context, checks dependencies
- **Post-task** — verifies completeness, runs quality gates, updates state
- **Pre-commit** — security scan, code quality checks, commit message validation
- **Post-merge** — integration health, architecture conformance, documentation sync
- **Learn** — pattern extraction, knowledge capture after significant events

### Sprint-Based Execution
Work flows through a structured lifecycle instead of ad-hoc requests:

```
init → plan → sprint → execute → verify → review → learn
                ↑                                      │
                └──────────────────────────────────────┘
```

- **Plan** — converts your architecture into a prioritized roadmap of epics
- **Sprint** — slices one epic into a scoped sprint with clear deliverables
- **Execute** — implements tasks one by one, enforcing standards throughout
- **Verify** — checks acceptance criteria, test coverage, architecture conformance
- **Review** — multi-agent review covering code quality, security, and architecture
- **Learn** — compresses completed work into memory, extracts reusable patterns

### Context Engineering
Prevents the #1 problem with AI on large projects — context rot:
- **Context packs** — pre-assembled bundles for each phase (planning, sprint, execution, review)
- **Inclusion policies** — what always gets loaded (architecture, active sprint, relevant rules)
- **Exclusion policies** — what never gets loaded (old sprint details, unrelated modules)
- **Compression policies** — completed sprints become summaries, not token-heavy raw data
- **Freshness policies** — recent state beats old summaries, code beats stale docs

### Continuous Learning
BuildOS gets smarter with every sprint:
- Extracts reusable patterns from completed work
- Records what worked and what didn't
- Updates project memory with new decisions
- Compresses historical context without losing key insights
- Tracks confidence scores on learned patterns

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   GOVERNANCE                         │
│  Always active. Project memory, agents, standards,   │
│  hooks, skills. The quality immune system.           │
├─────────────────────────────────────────────────────┤
│                    CONTEXT                           │
│  Orchestrator. Assembles minimal relevant context.   │
│  Packs, policies, loaders, summaries.                │
├─────────────────────────────────────────────────────┤
│                   EXECUTION                          │
│  Sprint-scoped. Plan, execute, verify, learn.        │
│  Workflows, task agents, templates.                  │
└─────────────────────────────────────────────────────┘
```

**Governance** is permanent — it holds your project truth and quality standards. It is loaded into every operation.

**Context** sits in the middle — it decides what each command sees, preventing both token waste and context starvation.

**Execution** is temporary — it runs sprint-scoped workflows that produce artifacts, which governance then evaluates.

Key rule: **Execution operates inside governance boundaries.** It can propose changes but never silently overwrite standards, architecture, or decisions.

---

## Installation

### Prerequisites

- [Claude Code](https://claude.ai/code) installed and configured
- Node.js 18+ (for the CLI tool)
- A project you want to work on

### Option A: Copy into your project

```bash
# Clone the BuildOS repository
git clone https://github.com/kohrohit/buildos.git /tmp/buildos

# Copy into your project
cp -r /tmp/buildos/build/ /path/to/your-project/build/

# Clean up
rm -rf /tmp/buildos
```

### Option B: Clone directly

```bash
cd /path/to/your-project
git clone https://github.com/kohrohit/buildos.git build
```

### Verify installation

```bash
# Check the CLI tool works
node build/bin/build-tools.cjs status
# Expected output: "BuildOS not initialized. Run /build-init first."
```

### Folder structure after installation

```
your-project/
├── build/
│   ├── governance/          # Standards, agents, rules, project brain
│   │   ├── agents/          # 7 specialist agents
│   │   ├── rules/           # Coding standards (global + per-language)
│   │   ├── hooks/           # Quality gates at key lifecycle moments
│   │   ├── skills/          # Reusable operational knowledge
│   │   └── brain/           # Project memory (vision, architecture, domain)
│   ├── engine/              # Sprint execution workflows
│   │   ├── workflows/       # Plan, sprint, execute, verify, research, release
│   │   ├── agents/          # Task-focused agents (planner, executor, verifier)
│   │   └── templates/       # Epic, sprint, spec, task, test, report templates
│   ├── context/             # Context engineering layer
│   │   ├── loaders/         # Context assembly per command
│   │   ├── policies/        # Inclusion, exclusion, compression, freshness
│   │   ├── templates/       # Context pack definitions
│   │   └── summaries/       # Compressed historical context
│   ├── commands/            # /build:* command definitions
│   ├── state/               # Runtime state (JSON)
│   ├── bin/                 # CLI tool
│   ├── docs/                # Documentation
│   ├── hooks.json           # Hook definitions
│   └── README.md
└── your-source-code/
```

---

## How to Use

### Step 1: Initialize your project

Start a Claude Code session and run:

```
/build:init
```

This creates:
- Starter project brain files in `governance/brain/`
- Empty state files in `state/`
- Default context configuration

### Step 2: Plan your roadmap (includes architecture discovery)

```
/build:plan
```

BuildOS first runs **architecture discovery** — asking what grade of system you're building (PoC through Mission-Critical), then asking the right questions at the right depth. It populates `architecture.md`, `nfrs.md`, and creates your first ADR automatically.

Then it produces a prioritized roadmap:

```
Roadmap Generated:
  Epic 1: Core data model + migrations         [priority: high]
  Epic 2: GPS ingestion pipeline               [priority: high]
  Epic 3: REST API endpoints                   [priority: high]
  Epic 4: ETA prediction service               [priority: medium]
  Epic 5: Notification system                  [priority: medium]
  Epic 6: API gateway + auth                   [priority: high]
```

### Step 4: Start a sprint

```
/build:sprint
```

BuildOS selects the highest-priority epic and decomposes it:

```
Sprint Created:
  Goal: Core data model and migrations
  Duration: 1 sprint cycle

  Tasks:
    1. Create Vehicle model and migration
    2. Create Delivery model and migration
    3. Create Fleet model and migration
    4. Create Geofence model with PostGIS support
    5. Write seed data scripts
    6. Write model unit tests

  Acceptance Criteria:
    - All migrations reversible
    - All models have created_at/updated_at
    - Foreign key relationships enforced
    - PostGIS extension configured
    - 90%+ test coverage on models
```

### Step 5: Execute the sprint

```
/build:execute
```

BuildOS works through each task:
- Loads only relevant context (domain model, architecture, Python rules)
- Applies your coding standards automatically
- Runs quality hooks after each task
- Updates task state as work progresses
- Flags blockers if encountered

### Step 6: Verify the work

```
/build:verify
```

Spawns **isolated review agents** in separate worktrees with blind context (no knowledge of how the code was written). Checks acceptance criteria, runs tests, linter, and type checker. Architecture violations always cause FAIL.

### Step 7: Deep review with isolated specialist agents

```
/build:review
```

Spawns 4 **fully isolated agents in parallel** — each in its own worktree, seeing only the spec and the code:
- **Code Reviewer** (Sonnet) — naming, complexity, SOLID, DRY, test coverage
- **Security Reviewer** (Opus) — OWASP Top 10, secrets, input validation, auth
- **Architect** (Opus) — module boundaries, dependency direction, ADR conformance
- **QA Verifier** (Sonnet) — acceptance criteria coverage, test gaps, edge cases

Cross-agent escalation: if 2+ agents flag the same area, it becomes an auto-blocker.

### Step 8: Learn and compress

```
/build:learn
```

- Compresses the sprint into a summary (decisions, outcomes, patterns)
- Extracts reusable patterns (e.g., "PostGIS migrations need `CREATE EXTENSION` step")
- Updates project memory with new architecture decisions
- Archives raw sprint details, keeping only the summary for future context

### Step 9: Continue

Loop back to `/build:sprint` for the next epic, or `/build:plan` to re-prioritize.

### Check status anytime

```
/build:status
```

Shows:
- Active project and roadmap position
- Current sprint progress
- Active task and blockers
- Last review status
- Recently learned patterns

---

## Commands Reference

| Command | What it does |
|---------|-------------|
| `/build:init` | Initialize project brain, state files, and context defaults |
| `/build:plan` | Generate prioritized roadmap from project brain |
| `/build:sprint` | Slice next epic into a scoped sprint with tasks and acceptance criteria |
| `/build:execute` | Execute current sprint tasks under governance constraints |
| `/build:verify` | Verify output against acceptance criteria and standards |
| `/build:review` | Multi-agent review for code quality, security, and architecture |
| `/build:learn` | Compress completed work into memory, extract patterns |
| `/build:status` | Show current project state, progress, and health |

---

## Extending BuildOS

### Add a new language rule

Create `governance/rules/your-language.md`:
```markdown
# Your Language Rules

## Design Standards
- ...

## Naming Conventions
- ...

## Test Expectations
- ...

## Security Constraints
- ...

## Anti-Patterns
- ...
```

### Add a new specialist agent

Create `governance/agents/your-agent.md`:
```markdown
---
name: your-agent
description: What this agent does
tools: ["Read", "Grep", "Glob"]
model: claude-sonnet-4-6  # Use claude-opus-4-6 for high-stakes judgment
---

## Purpose
...

## Responsibilities
...

## Decision Boundaries
...
```

### Add a new workflow

Create `engine/workflows/your-workflow.md` with goal, inputs, steps, outputs, checks, and failure handling.

### Add a new context pack

Create `context/templates/your-pack.md` specifying what to include, exclude, and the token budget.

---

## Documentation

- [Architecture](docs/architecture.md) — 3-layer architecture deep dive
- [Usage Guide](docs/usage.md) — detailed walkthrough
- [Context Engineering](docs/context-engineering.md) — how context packs, policies, and summaries work
- [Command Reference](docs/command-reference.md) — full reference for all commands

---

## License

MIT
