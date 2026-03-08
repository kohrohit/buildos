# Inclusion Policy

## Purpose

Defines what context MUST be loaded for each phase of the BuildOS workflow.
This is not optional — missing required context leads to drift, inconsistency,
and rework. Every phase has a mandatory context set.

## Mandatory Context by Phase

### Planning (`/build:plan`)

| Context | Source | Reason |
|---|---|---|
| Vision | `brain/vision.md` | All plans must align with project goals |
| Architecture | `brain/architecture.md` | Plans must respect system boundaries |
| NFRs | `brain/nfrs.md` | Plans must account for quality constraints |
| Glossary | `brain/glossary.md` | Consistent terminology in sprint specs |
| Active ADRs | `brain/adrs/` (accepted/proposed) | Plans must not contradict decisions |
| Project summary | `context/summaries/project-summary.md` | Continuity with past work |
| Learned patterns | `context/summaries/learned-patterns-summary.md` | Avoid repeating mistakes |

### Execution (`/build:execute`)

| Context | Source | Reason |
|---|---|---|
| Active sprint spec | `state/current-sprint.md` | Know what to build |
| Task list | `state/tasks.md` | Know specific assignments |
| Sprint state | `state/sprint-state.md` | Know current progress and blockers |
| Module context | Via `load-module.md` | Understand the code being touched |
| Coding rules | Via `load-rules.md` | Write code to standards |
| Architecture | `brain/architecture.md` | Respect boundaries during implementation |

### Review (`/build:review`, `/build:verify`)

| Context | Source | Reason |
|---|---|---|
| Sprint spec | `state/current-sprint.md` | Verify against acceptance criteria |
| NFRs | `brain/nfrs.md` | Check non-functional compliance |
| Architecture | `brain/architecture.md` | Verify boundary respect |
| Coding rules | Via `load-rules.md` | Enforce standards |
| Active ADRs | `brain/adrs/` (accepted) | Verify decision compliance |
| Module context | Via `load-module.md` | Understand what changed and why |

## Priority Ordering

When token budget forces choices, load in this priority order:

1. **Critical** — Vision, architecture, active sprint spec, task list
2. **High** — NFRs, coding rules, sprint state, module summary
3. **Medium** — Glossary, learned patterns, ADRs, module details
4. **Low** — Historical summaries, superseded ADR references, git history

Never drop Critical context. High context may be summarized but not dropped.
Medium and Low context can be dropped if budget requires it.

## What "Relevant" Means

Context is relevant when it directly applies to the current task:

- **Relevant module**: The module containing the files being created or modified.
  Example: If task says "add auth middleware," the `auth` module is relevant.
- **Relevant ADR**: An ADR whose decision affects the current implementation.
  Example: ADR-003 choosing JWT over sessions is relevant when implementing auth.
- **Relevant rules**: Rules for the language/framework of files being touched.
  Example: TypeScript rules are relevant when editing `.ts` files, not when editing docs.
- **Relevant history**: Past sprint outcomes that inform current work.
  Example: Sprint-02 summary is relevant if it notes a failed approach to caching.

## Cross-Phase Context

Some context spans phases and should persist:

- Architecture is loaded in every phase — it is the universal constant
- Sprint spec persists from sprint start through verification
- Coding rules persist throughout execution and review
- Glossary persists across planning and documentation tasks

## Enforcement

- Before executing any phase command, verify all mandatory context is loaded
- If mandatory context is missing (file does not exist), halt and report
- If mandatory context is stale (see freshness-policy.md), warn but proceed
- Log which context was loaded for auditability
