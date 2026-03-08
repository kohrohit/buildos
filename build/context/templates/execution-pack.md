# Execution Context Pack

## Purpose

Assembles context for the `/build:execute` phase. Execution requires the most
focused, task-specific context. Unlike planning which is broad, execution packs
are narrow and deep — they load detailed context for the specific module and task
being worked on while excluding everything else.

## Phase

`/build:execute` — Task implementation, coding, testing

## Included Loaders

| Order | Loader | Mode | Purpose |
|---|---|---|---|
| 1 | `load-sprint.md` | Filtered | Current task + sprint spec only |
| 2 | `load-module.md` | Deep | Full context for the active module |
| 3 | `load-rules.md` | Full | Rules for detected languages/frameworks |
| 4 | `load-governance.md` | Minimal | Architecture slice for active module only |

## Additional Context

| Source | Condition |
|---|---|
| Related module summary | If current task has cross-module dependencies |
| Specific ADR | If task references an architectural decision |
| Test patterns | If task involves writing or modifying tests |

## Excluded Context

- Full governance brain — only the architecture slice for the active module
- Historical context — execution uses current state, not history
- Unrelated modules — strict scope isolation
- Vision document — too abstract for implementation
- Project summary — too broad for task-level work
- NFRs not related to the active module — load only applicable ones
- Sprint tasks not currently being worked on — minimize noise

## Token Budget

| Layer | Budget | Source |
|---|---|---|
| Sprint (filtered) | 800 tokens | Active task + sprint goals only |
| Module (deep) | 1500 tokens | `load-module.md` full depth |
| Rules | 1000 tokens | `load-rules.md` |
| Governance (minimal) | 500 tokens | Architecture slice only |
| Additional | 500 tokens | Cross-module refs, ADRs |
| **Total** | **4300 tokens** | |
| **Hard ceiling** | **5500 tokens** | |

## Assembly Order

1. Identify the active task from sprint state (currently in-progress)
2. Load the active task details and sprint acceptance criteria
3. Resolve the task's module and load deep module context
4. Detect language/framework from module files and load rules
5. Extract architecture slice relevant to the module
6. Load cross-module dependencies if task requires them
7. Validate pack — ensure task, module, and rules are all present

## Task Scoping

The execution pack loads context for ONE task at a time:

- Read `state/sprint-state.md` to find the task with status `in-progress`
- If multiple tasks are in-progress, load context for the first one
- If no task is in-progress, prompt the agent to select and start a task
- Task switching requires reassembling the execution pack

## Expected Outputs

The execution phase, with this context loaded, should produce:

- Code changes implementing the active task
- Tests for the implemented functionality
- Updated task status in `state/tasks.md`
- Updated sprint state in `state/sprint-state.md`
- Updated module summary if significant changes were made

## Pre-Assembly Checklist

- [ ] Verify an in-progress task exists in sprint state
- [ ] Verify the task's module has context available
- [ ] Verify coding rules exist for the task's language
- [ ] Verify architecture.md covers the task's module
- [ ] Confirm no blockers on the active task
