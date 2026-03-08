# Review Context Pack

## Purpose

Assembles context for `/build:review` and `/build:verify` phases. Review requires
a dual perspective — understanding what was supposed to be built (spec and
acceptance criteria) and how it was actually built (code, tests, architecture
compliance). This pack bridges governance and implementation.

## Phases

- `/build:review` — Code review, design review, mid-sprint check
- `/build:verify` — Sprint verification, acceptance criteria validation

## Included Loaders

| Order | Loader | Mode | Purpose |
|---|---|---|---|
| 1 | `load-sprint.md` | Full | Sprint spec, all tasks, current state |
| 2 | `load-module.md` | Deep | Each module modified in the sprint |
| 3 | `load-rules.md` | Full | All applicable coding standards |
| 4 | `load-governance.md` | Focused | Architecture, NFRs, relevant ADRs |

## Additional Context

| Source | Condition |
|---|---|
| Git diff / change summary | Always — the actual changes under review |
| Test results | Always — pass/fail status for all affected tests |
| NFRs checklist | Always — verify non-functional compliance |
| Previous review notes | If this is a re-review after fixes |

## Excluded Context

- Historical sprint summaries — review is about the current sprint
- Learned patterns — not applicable during review (patterns are extracted after)
- Vision document — sprint spec encodes the relevant vision aspects
- Project summary — too broad for review scope
- Modules not modified in this sprint — out of review scope
- Unrelated coding rules — only rules for languages used in changes

## Token Budget

| Layer | Budget | Source |
|---|---|---|
| Sprint | 2000 tokens | `load-sprint.md` full |
| Modules | 2000 tokens | `load-module.md` per modified module |
| Rules | 1000 tokens | `load-rules.md` |
| Governance | 1500 tokens | Architecture, NFRs, ADRs |
| Additional | 1000 tokens | Diffs, test results, NFR checklist |
| **Total** | **7500 tokens** | |
| **Hard ceiling** | **9000 tokens** | |

## Assembly Order

1. Load sprint spec and full task list (establishes what was promised)
2. Identify all modules modified during the sprint
3. Load deep context for each modified module
4. Load applicable coding rules for all languages touched
5. Load architecture, NFRs, and referenced ADRs
6. Load git diff summary and test results
7. Construct review checklist from NFRs and acceptance criteria
8. Validate pack completeness

## Review Checklist Assembly

The pack automatically constructs a review checklist from loaded context:

- **Acceptance criteria** — extracted from `state/current-sprint.md`
- **NFR compliance** — mapped from `brain/nfrs.md` to modified modules
- **Architecture compliance** — boundaries and patterns from `brain/architecture.md`
- **Coding standards** — rules from loaded rule files
- **ADR compliance** — relevant decisions that constrain implementation
- **Test coverage** — expected tests vs actual tests present

## Expected Outputs

The review phase, with this context loaded, should produce:

- Review findings with severity (critical, major, minor, suggestion)
- Compliance report against acceptance criteria
- NFR compliance assessment
- Architecture boundary violation report (if any)
- Recommended fixes or improvements
- Updated learned patterns (if review surfaces reusable insights)

## Pre-Assembly Checklist

- [ ] Verify sprint spec exists with defined acceptance criteria
- [ ] Verify all tasks have implementation status updated
- [ ] Verify test suite has been run and results are available
- [ ] Verify modified modules are identifiable from git or sprint state
- [ ] Verify NFRs document exists for compliance checking
