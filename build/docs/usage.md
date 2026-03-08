# BuildOS Usage Guide

A practical guide to using BuildOS in your projects, from first setup through ongoing development cycles.

---

## Prerequisites

- **Claude Code** installed and configured with a valid API key.
- A project directory where you want to use BuildOS.
- Basic familiarity with Claude Code slash commands.

---

## Setup

### Step 1: Add BuildOS to Your Project

Copy the `build/` directory into your project root:

```bash
cp -r /path/to/buildos/build/ ./your-project/build/
```

Your project structure should look like:

```
your-project/
├── build/
│   ├── governance/
│   ├── engine/
│   ├── context/
│   ├── commands/
│   ├── state/
│   └── ...
├── src/           # your existing code
├── package.json   # your existing config
└── ...
```

### Step 2: Start Claude Code

```bash
cd your-project
claude
```

### Step 3: Initialize BuildOS

```
/build:init
```

This creates the project brain files in `build/governance/brain/` with starter templates. It scans your existing codebase to pre-populate architecture and domain model where possible.

---

## Configuring Your Project Brain

After initialization, edit the brain files to reflect your project's specifics. These files are the foundation of everything BuildOS does — the more accurate they are, the better BuildOS performs.

### vision.md

Define what you are building and why. Include:
- Product description (1-2 paragraphs).
- Target users and their primary needs.
- Success criteria — how you know the product is working.
- Non-goals — what this product explicitly does not do.

### architecture.md

Define how the system is structured. Include:
- High-level component diagram (text-based).
- Tech stack with version constraints.
- System boundaries — what is inside your system vs. external.
- Integration points — APIs, databases, message queues, third-party services.
- Deployment model — how and where the system runs.

### domain-model.md

Define the core domain. Include:
- Entities with their attributes and types.
- Relationships between entities (one-to-many, many-to-many, etc.).
- Invariants — rules that must always be true (e.g., "an order must have at least one line item").
- Lifecycle rules — valid state transitions (e.g., "a task can only move from IN_PROGRESS to DONE, never from TODO to DONE directly").

### nfrs.md

Define non-functional requirements. Include:
- Performance targets (response times, throughput).
- Security requirements (authentication, authorization, data protection).
- Reliability targets (uptime, error rates, recovery time).
- Scalability expectations (concurrent users, data volume).
- Accessibility standards (WCAG level, supported assistive technologies).

### glossary.md

Define your ubiquitous language. For each term, provide:
- The canonical name.
- A precise definition.
- Usage context (where this term applies).
- Common misuses (what this term does not mean).

---

## The Development Cycle

### Planning: `/build:plan`

Run this when you need a roadmap or when priorities have shifted.

```
/build:plan
```

BuildOS reads your brain files and any existing codebase, then generates a structured roadmap with milestones, epics, and estimated scope. The roadmap is saved to `build/state/roadmap.md`.

Review the roadmap. Edit it if priorities need adjustment. The roadmap is a living document — you control it, BuildOS proposes it.

**When to re-plan:**
- After completing a major milestone.
- When requirements change significantly.
- When you learn something that invalidates assumptions.

### Sprint Setup: `/build:sprint`

Run this when you are ready to start the next chunk of work.

```
/build:sprint
```

BuildOS selects the next highest-priority work from the roadmap, decomposes it into concrete tasks, sets acceptance criteria, and identifies dependencies. The sprint plan is saved to `build/state/current-sprint.md`.

Review the sprint plan. Adjust task scope or ordering if needed. Each task should be small enough to complete in a single focused session.

**Sprint sizing guidance:**
- Small projects: 3-5 tasks per sprint.
- Medium projects: 5-8 tasks per sprint.
- Large projects: 5-10 tasks per sprint (keep focused, avoid sprawl).

### Execution: `/build:execute`

Run this to start working through sprint tasks.

```
/build:execute
```

BuildOS works through tasks sequentially. For each task:
1. The context loader assembles relevant context (current task spec, related code, applicable rules).
2. The executor implements the task — writing code, tests, and documentation.
3. Governance rules are checked in real time during implementation.
4. Task state is updated in `build/state/current-sprint.md`.

You can interrupt execution at any time. State is saved after each task. Running `/build:execute` again resumes from the next incomplete task.

**During execution, you can:**
- Watch and provide guidance in real time.
- Ask questions about what the executor is doing.
- Override decisions by providing explicit instructions.
- Skip tasks by marking them as deferred in the sprint plan.

### Verification: `/build:verify`

Run this after execution to validate the work.

```
/build:verify
```

BuildOS runs a comprehensive verification suite:
- **Tests** — Executes all test suites and reports results.
- **Linting** — Runs configured linters and formatters.
- **Type checking** — Runs type checker if applicable.
- **Architecture compliance** — Validates that code respects module boundaries, dependency rules, and integration contracts.
- **NFR audit** — Checks measurable non-functional requirements where possible.

Verification output is saved to `build/state/sprints/sprint-N-verify.md`. Fix any issues and re-run `/build:verify` until clean.

### Review: `/build:review`

Run this after verification passes.

```
/build:review
```

Governance agents perform a structured review:
- **Standards compliance** — Do all files follow naming conventions, structural rules, and coding standards?
- **Architecture alignment** — Do changes respect system boundaries and component responsibilities?
- **Domain correctness** — Do entity relationships, invariants, and lifecycle rules match the domain model?
- **NFR adherence** — Are non-functional requirements addressed?

Review findings are saved to `build/state/sprints/sprint-N-review.md`. Address any issues raised.

### Learning: `/build:learn`

Run this after review is complete and all issues are resolved.

```
/build:learn
```

BuildOS performs end-of-sprint compression:
1. **Summarize** — Create a sprint summary capturing what was done, what was decided, and what was learned.
2. **Archive** — Move sprint detail to `build/state/sprints/` archive.
3. **Update brain** — If the sprint revealed new architectural decisions, domain insights, or rule refinements, propose updates to brain files.
4. **Compress context** — Replace detailed sprint state with the compressed summary for future context loads.

### Status: `/build:status`

Run this anytime to see where things stand.

```
/build:status
```

Shows:
- Current sprint state (tasks done/remaining/blocked).
- Roadmap progress (milestones completed/remaining).
- Recent verification results.
- Recent review findings.
- Project health indicators.

---

## Tips for Large Projects

**Scope governance tightly.** A large project needs more rules, more architectural boundaries, and more domain precision. Invest time in brain files upfront — it pays off exponentially as the project grows.

**Keep sprints small and focused.** Resist the urge to pack sprints. Large sprints lead to context bloat and diffuse attention. Prefer 5 tightly-scoped tasks over 15 loosely-scoped ones.

**Use module summaries aggressively.** After completing a module, write a clear module summary. This prevents the context layer from having to load full module source in future sprints that touch adjacent modules.

**Re-plan regularly.** Large projects accumulate drift. Run `/build:plan` after every 2-3 sprints to re-prioritize based on what you have learned.

**Create domain-specific rules.** Generic coding standards are a starting point. Add rules specific to your domain — e.g., "all financial calculations must use decimal types, never floating point" or "all patient data access must be audit-logged."

---

## Tips for Small Projects

**Start lean.** A small project does not need 50 governance rules. Start with vision, a basic architecture sketch, and a domain model. Add rules as patterns emerge.

**Combine sprints with verification.** For small projects, you can run `/build:execute` followed by `/build:verify` in quick succession. The overhead of formal sprint ceremonies is less valuable when the scope is small.

**Use brain files as living documentation.** In a small project, the brain files may be the only documentation you need. Keep them updated and they serve double duty.

---

## Tips for Team Usage

**Commit brain files to version control.** The `build/governance/brain/` directory is your project's institutional memory. It should be versioned, reviewed, and treated with the same care as production code.

**Review brain changes in PRs.** When someone proposes a change to architecture, domain model, or rules, it should go through code review. These changes affect every future BuildOS invocation.

**Share sprint summaries.** Sprint summaries in `build/state/sprints/` are useful for team-wide visibility. They capture what was done and why without the noise of full sprint detail.

**Standardize governance across projects.** If your team has organization-wide coding standards, security policies, or architectural patterns, create a shared governance baseline that all projects inherit from.

**Use ADRs for architectural disagreements.** When team members disagree on an architectural choice, write an ADR. It forces clear articulation of the decision, alternatives considered, and rationale. BuildOS governance agents will enforce the decision going forward.

---

## Troubleshooting

**BuildOS is loading too much context.** Check `build/context/policies/` and tighten exclusion rules. Common culprits: old sprint data not being compressed, module internals being loaded unnecessarily.

**Governance is too strict / blocking valid work.** Rules are meant to be refined. If a rule is consistently wrong, update it in `build/governance/rules/`. If a rule is right but needs an exception, document the exception in an ADR.

**Sprint tasks are too large.** If a single task takes more than one focused session, decompose it further. Large tasks cause context problems because the context loader cannot determine which subset of the task is currently relevant.

**Execution is drifting from the plan.** This usually means the sprint plan was underspecified. Improve task specifications — add clearer acceptance criteria, more precise scope boundaries, and explicit constraints.

**Brain files are stale.** Run `/build:learn` consistently. The learn step is where brain files get updated with new insights. Skipping it causes governance to enforce outdated standards.
