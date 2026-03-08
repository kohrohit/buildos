# Sprint Context Pack

## Purpose

Assembles context for the `/build:sprint` phase. This phase bridges planning and
execution — it takes the sprint spec and prepares the working context for task
implementation. Requires both governance awareness and operational detail.

## Phase

`/build:sprint` — Sprint kickoff, task decomposition, dependency mapping

## Included Loaders

| Order | Loader | Mode | Purpose |
|---|---|---|---|
| 1 | `load-governance.md` | Slim | Architecture and active ADRs only |
| 2 | `load-sprint.md` | Full | Sprint spec, tasks, state |
| 3 | `load-module.md` | Shallow | Summaries for all modules touched this sprint |
| 4 | `load-rules.md` | Full | All applicable language/framework rules |

## Additional Context

| Source | Condition |
|---|---|
| `brain/nfrs.md` | Always — tasks must map to quality requirements |
| Cross-module dependency map | If sprint touches multiple modules |
| Previous sprint summary | If sprint continues work from the prior sprint |

## Excluded Context

- Full module internals — use shallow mode for module summaries only
- Historical sprint details beyond the most recent summary
- Vision document — sprint spec already encodes relevant vision aspects
- Project-level summary — too broad for sprint-level work
- Learned patterns — already factored into sprint spec during planning
- Research documents — planning phase should have resolved open questions

## Token Budget

| Layer | Budget | Source |
|---|---|---|
| Governance (slim) | 1500 tokens | Architecture + ADRs only |
| Sprint | 2000 tokens | `load-sprint.md` |
| Modules (shallow) | 1000 tokens | `load-module.md` per module |
| Rules | 1000 tokens | `load-rules.md` |
| Additional | 500 tokens | NFRs, dependency map |
| **Total** | **6000 tokens** | |
| **Hard ceiling** | **7500 tokens** | |

## Assembly Order

1. Load architecture and active ADRs (governance slim)
2. Load sprint spec and task list (establishes scope)
3. Identify modules touched by sprint tasks
4. Load shallow module summaries for identified modules
5. Detect languages/frameworks from sprint tasks and module context
6. Load applicable coding rules
7. Append NFRs and cross-module dependencies
8. Validate pack against inclusion policy

## Expected Outputs

The sprint phase, with this context loaded, should produce:

- Refined task list with implementation order and dependencies
- Module-level work breakdown (which tasks affect which modules)
- Identified risks and potential blockers
- Updated sprint state with kickoff status

## Pre-Assembly Checklist

- [ ] Verify sprint spec exists (`state/current-sprint.md`)
- [ ] Verify task list is populated (`state/tasks.md`)
- [ ] Verify all referenced modules have summaries (or create stubs)
- [ ] Verify coding rules exist for detected languages
- [ ] Initialize sprint state (`state/sprint-state.md`) if not present
