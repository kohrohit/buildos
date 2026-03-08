# BuildOS Internal Architecture Map

This document maps every BuildOS component to its origin capability.
Two source systems were combined:

- **Governance System** — always-active quality layer (standards, agents, hooks, memory, review)
- **Execution System** — sprint-scoped delivery engine (plan, execute, verify, research)

A third layer, **Context Engineering**, is original to BuildOS.

---

## Component Origin Map

### Governance Layer (Always Active)

| Component | Path | Origin | What It Does |
|-----------|------|--------|-------------|
| Architect agent | `governance/agents/architect.md` | Governance | System design, ADRs, technology decisions |
| Security reviewer | `governance/agents/security-reviewer.md` | Governance | OWASP, auth, secrets, PII |
| Code reviewer | `governance/agents/code-reviewer.md` | Governance | Clean code, SOLID, complexity |
| Backend engineer | `governance/agents/backend-engineer.md` | Governance | API design, DB patterns, services |
| QA verifier | `governance/agents/qa-verifier.md` | Governance | Test strategy, acceptance validation |
| Documentation writer | `governance/agents/documentation-writer.md` | Governance | API docs, runbooks, ADRs |
| Platform engineer | `governance/agents/platform-engineer.md` | Governance | CI/CD, Docker, infra |
| Global rules | `governance/rules/global.md` | Governance | Universal engineering standards |
| Java/Spring rules | `governance/rules/java-spring.md` | Governance | Spring Boot standards |
| Python rules | `governance/rules/python.md` | Governance | Python/FastAPI/Django standards |
| TypeScript rules | `governance/rules/typescript.md` | Governance | TypeScript/Node standards |
| React rules | `governance/rules/react.md` | Governance | React/Next.js standards |
| Pre-task hook | `governance/hooks/pre-task.md` | Governance | Context loading, dependency check before task |
| Post-task hook | `governance/hooks/post-task.md` | Governance | Quality gates after task completion |
| Pre-commit hook | `governance/hooks/pre-commit.md` | Governance | Security scan, code quality before commit |
| Post-merge hook | `governance/hooks/post-merge.md` | Governance | Integration health after merge |
| Learn hook | `governance/hooks/learn.md` | Governance | Pattern extraction, knowledge capture |
| Architecture patterns | `governance/skills/architecture-patterns.md` | Governance | Layered, hexagonal, CQRS, event-driven |
| Sprint planning skill | `governance/skills/sprint-planning.md` | Governance | Work slicing, estimation, criteria |
| Code review skill | `governance/skills/code-review.md` | Governance | Review process, feedback format |
| Testing strategy | `governance/skills/testing-strategy.md` | Governance | Test pyramid, coverage targets |
| Security baseline | `governance/skills/security-baseline.md` | Governance | Auth, validation, secrets, headers |
| Vision template | `governance/brain/vision.md` | Governance | Product vision, goals, success criteria |
| Architecture doc | `governance/brain/architecture.md` | Governance | Tech stack, module boundaries |
| Domain model | `governance/brain/domain-model.md` | Governance | Entities, aggregates, invariants |
| NFRs | `governance/brain/non-functional-requirements.md` | Governance | Performance, security, scalability targets |
| Glossary | `governance/brain/glossary.md` | Governance | Ubiquitous language |
| ADR template | `governance/brain/adr/000-template.md` | Governance | Architecture decision record format |

**Total: 28 files — all Governance origin**

---

### Execution Layer (Sprint-Scoped)

| Component | Path | Origin | What It Does |
|-----------|------|--------|-------------|
| Plan workflow | `engine/workflows/plan.md` | Execution | Vision → roadmap with epics and dependencies |
| Sprint workflow | `engine/workflows/sprint.md` | Execution | Epic → sprint slice with scope and criteria |
| Execute workflow | `engine/workflows/execute.md` | Execution | Task-by-task implementation under governance |
| Verify workflow | `engine/workflows/verify.md` | Execution | Acceptance criteria + standards verification |
| Research workflow | `engine/workflows/research.md` | Execution | Technical investigation before implementation |
| Release workflow | `engine/workflows/release.md` | Execution | Release validation, changelog, versioning |
| Planner agent | `engine/agents/planner.md` | Execution | Decomposes work into plans and specs |
| Executor agent | `engine/agents/executor.md` | Execution | Implements code per task spec |
| Verifier agent | `engine/agents/verifier.md` | Execution | Validates output against criteria |
| Researcher agent | `engine/agents/researcher.md` | Execution | Investigates technical questions |
| Epic template | `engine/templates/epic-template.md` | Execution | Epic structure with business value |
| Sprint template | `engine/templates/sprint-template.md` | Execution | Sprint spec with scope and criteria |
| Spec template | `engine/templates/spec-template.md` | Execution | Feature spec with API contracts |
| Task template | `engine/templates/task-template.md` | Execution | Individual task definition |
| Test template | `engine/templates/test-template.md` | Execution | Test plan structure |
| Report template | `engine/templates/report-template.md` | Execution | Sprint/task execution report |

**Total: 16 files — all Execution origin**

---

### Context Layer (BuildOS Original)

| Component | Path | Origin | What It Does |
|-----------|------|--------|-------------|
| Load governance | `context/loaders/load-governance.md` | Context | Assembles governance brain for planning/review |
| Load sprint | `context/loaders/load-sprint.md` | Context | Assembles active sprint context |
| Load module | `context/loaders/load-module.md` | Context | Assembles single module context |
| Load rules | `context/loaders/load-rules.md` | Context | Auto-detects and loads language rules |
| Load history | `context/loaders/load-history.md` | Context | Loads compressed historical context |
| Inclusion policy | `context/policies/inclusion-policy.md` | Context | What always gets loaded per phase |
| Exclusion policy | `context/policies/exclusion-policy.md` | Context | What never gets loaded |
| Compression policy | `context/policies/compression-policy.md` | Context | When/how to compress old context |
| Freshness policy | `context/policies/freshness-policy.md` | Context | How to resolve old vs new conflicts |
| Base context pack | `context/templates/context-pack.md` | Context | Template for context pack structure |
| Planning pack | `context/templates/planning-pack.md` | Context | Context bundle for /build:plan |
| Sprint pack | `context/templates/sprint-pack.md` | Context | Context bundle for /build:sprint |
| Execution pack | `context/templates/execution-pack.md` | Context | Context bundle for /build:execute |
| Review pack | `context/templates/review-pack.md` | Context | Context bundle for /build:review |
| Project summary | `context/summaries/project-summary.md` | Context | Project-level compressed memory |
| Patterns summary | `context/summaries/learned-patterns-summary.md` | Context | Accumulated patterns from all sprints |

**Total: 16 files — all Context origin (BuildOS original)**

---

### Orchestration Layer (Shared)

| Component | Path | Origin | What It Does |
|-----------|------|--------|-------------|
| /build:init | `commands/build-init.md` | Governance + Execution | Seeds brain (Gov), creates state (Exec) |
| /build:plan | `commands/build-plan.md` | Execution + Context | Reads brain via context, runs planner |
| /build:sprint | `commands/build-sprint.md` | Execution + Context | Slices epic via sprint pack |
| /build:execute | `commands/build-execute.md` | Execution + Governance | Runs executor under governance rules |
| /build:verify | `commands/build-verify.md` | Governance + Execution | Gov agents verify exec output |
| /build:review | `commands/build-review.md` | Governance | Multi-agent governance review |
| /build:learn | `commands/build-learn.md` | Governance + Context | Extracts patterns, compresses context |
| /build:status | `commands/build-status.md` | Execution | Reads state, reports dashboard |
| CLI tool | `bin/build-tools.cjs` | Execution + Context | State CRUD, context assembly, routing |
| Hooks config | `hooks.json` | Governance | Hook definitions for Claude Code |

**Total: 10 files — mixed origin**

---

## How They Interact Per Command

### /build:init
```
[Governance] Seeds brain templates (vision, architecture, domain, NFRs, glossary)
[Execution]  Creates state files (project, roadmap, sprint, task, context, patterns)
[Context]    Initializes context-state.json with governance files
```

### /build:plan
```
[Context]    Loads planning-pack (governance brain + history + global rules)
[Execution]  Planner agent reads brain, produces roadmap with epics
[Governance] Architect agent validates proposed modules against architecture
[Execution]  Saves roadmap.json
```

### /build:sprint
```
[Context]    Loads sprint-pack (slim governance + full sprint + module context)
[Execution]  Planner agent decomposes epic into sprint tasks
[Governance] Validates scope against architecture and NFRs
[Execution]  Saves sprint-state.json and task-state.json
```

### /build:execute
```
[Context]    Loads execution-pack (single task + deep module + relevant rules)
[Governance] Pre-task hook validates task definition
[Execution]  Executor agent implements code
[Governance] Rules enforce coding standards during implementation
[Governance] Post-task hook runs quality gates
[Execution]  Updates task-state.json
```

### /build:verify
```
[Context]    Loads review-pack (sprint spec + implementation + all rules)
[Governance] QA verifier checks acceptance criteria
[Governance] Code reviewer checks code quality
[Governance] Security reviewer checks vulnerabilities
[Execution]  Verifier agent produces verification report
```

### /build:review
```
[Context]    Loads review-pack (full governance + sprint context)
[Governance] Architect checks module boundaries and dependency direction
[Governance] Security reviewer checks OWASP compliance
[Governance] Code reviewer checks standards adherence
[Governance] Records review findings in state
```

### /build:learn
```
[Governance] Learn hook extracts patterns from completed sprint
[Context]    Compression policy compresses sprint into summary
[Context]    Freshness policy archives stale summaries
[Governance] Updates governance brain if new ADRs needed
[Execution]  Updates learned-patterns.json
[Context]    Refreshes context-state.json
```

### /build:status
```
[Execution]  Reads all state files
[Execution]  Computes roadmap progress
[Execution]  Reports dashboard
```

---

## Visual: Which System Is Active When

```
Command        Governance    Execution    Context
─────────────  ───────────   ──────────   ────────
/build:init    ████████░░    ████████░░   ██░░░░░░
/build:plan    ████░░░░░░    ████████░░   ████████
/build:sprint  ████░░░░░░    ████████░░   ████████
/build:execute ████████░░    ████████░░   ████░░░░
/build:verify  ████████████  ████░░░░░░   ████░░░░
/build:review  ████████████  ░░░░░░░░░░   ████░░░░
/build:learn   ████████░░    ████░░░░░░   ████████
/build:status  ░░░░░░░░░░    ████████░░   ░░░░░░░░
```

Legend: `████` = heavily active, `░░░░` = inactive

---

## Key Design Rules

1. **Governance is always-on.** Even during execution, governance rules constrain what the executor can do.
2. **Execution is sprint-scoped.** Planner, executor, verifier, researcher agents are short-lived. They do their job and exit.
3. **Context mediates everything.** Neither governance nor execution loads its own context. The context layer decides what each command sees.
4. **Execution never silently rewrites governance.** If execution discovers an architecture change is needed, it proposes an ADR. It does not modify `governance/brain/` directly.
5. **Governance reviews execution output.** After every sprint, governance agents inspect what was built and flag deviations.
6. **Context compresses, governance remembers.** Completed sprint details are compressed by the context layer. Key decisions are preserved by governance in the brain and ADRs.
