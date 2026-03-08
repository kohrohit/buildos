# Workflow: Sprint

## Goal

Take one epic or module from the roadmap and create a sprint-ready execution slice. This workflow transforms a high-level epic into a concrete, time-boxed unit of work with clear deliverables, acceptance criteria, and test expectations that the execute workflow can consume directly.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Active roadmap | `state/roadmap.json` | Yes |
| Selected epic | `state/epics/{epic-id}.md` | Yes |
| Architecture spec | `governance/brain/architecture.md` | Yes |
| NFR requirements | `governance/brain/nfrs.md` | Yes |
| Previous sprint state | `state/sprint-state.json` | No |
| Dependency graph | `state/dependency-graph.json` | Yes |
| Sprint template | `engine/templates/sprint-template.md` | Yes |
| Task template | `engine/templates/task-template.md` | Yes |

## Steps

### Step 1: Select Epic

Determine which epic to sprint on next.

- Consult the roadmap for the next epic in sequence.
- Verify all hard dependencies for the selected epic are satisfied.
- If dependencies are unmet, select the next eligible epic or flag the blocker.
- Confirm the epic has not already been completed or is in-progress by another sprint.

### Step 2: Define Sprint Goal

Articulate a single, clear sprint goal that captures the intent of this execution slice.

- The goal must be a complete sentence describing the outcome, not the activity.
- The goal must be achievable within the sprint duration (default: 1-2 weeks equivalent of work).
- The goal must map to a measurable subset of the epic's acceptance criteria.
- If the epic is too large for one sprint, define the slice boundary explicitly.

### Step 3: Define Scope

Explicitly enumerate what is in scope and out of scope.

**In Scope:**
- List every module, feature, or component to be built or modified.
- Include all required tests, documentation updates, and configuration changes.
- Include any refactoring necessary to support the new work.

**Out of Scope:**
- Explicitly list related work that will NOT be done in this sprint.
- Note any shortcuts or temporary solutions being intentionally deferred.
- Identify future sprint work that depends on this sprint's output.

### Step 4: Define Deliverables

Break the sprint scope into concrete deliverables.

- Each deliverable must be a tangible artifact (code, test, config, document).
- Deliverables should be ordered by dependency (build sequence).
- Each deliverable maps to one or more tasks.
- Use `engine/templates/task-template.md` to generate individual task specifications.
- Assign estimated complexity to each task (trivial/small/medium/large).

### Step 5: Define Acceptance Criteria

For each deliverable and for the sprint as a whole, define acceptance criteria.

- Criteria must be binary (pass/fail), not subjective.
- Include functional criteria (does it work as specified).
- Include non-functional criteria from NFRs (performance, security, accessibility).
- Include integration criteria (does it work with existing modules).
- Map each criterion to a verifiable test or check.

### Step 6: Define Test Expectations

Specify the testing requirements for the sprint.

- Minimum unit test coverage target (from NFRs or default 80%).
- Required integration tests for cross-module interactions.
- Edge cases that must be explicitly tested.
- Performance benchmarks if applicable.
- Security test requirements if the sprint touches auth, data, or network boundaries.
- Use `engine/templates/test-template.md` for test planning structure.

### Step 7: Update Sprint State

Persist the sprint definition to state.

- Write the sprint specification to `state/sprints/{sprint-id}.md`.
- Write individual task specifications to `state/tasks/`.
- Update `state/sprint-state.json` with:
  - Sprint ID, goal, status (ready).
  - Task list with statuses (pending).
  - Start timestamp.
  - Link to parent epic.
- Update the epic status in `state/epics/` to reflect active sprint.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Sprint specification | `state/sprints/{sprint-id}.md` | Markdown |
| Task specifications | `state/tasks/{task-id}.md` | Markdown (per task) |
| Updated sprint state | `state/sprint-state.json` | JSON |
| Updated epic status | `state/epics/{epic-id}.md` | Markdown |
| Test plan | `state/sprints/{sprint-id}-tests.md` | Markdown |

## Checks

- The sprint goal is a single, measurable outcome statement.
- Every in-scope item has at least one deliverable.
- Every deliverable has at least one acceptance criterion.
- Every acceptance criterion has a corresponding test or check.
- The sprint does not include work from out-of-scope items.
- All task dependencies within the sprint are explicitly ordered.
- The sprint does not violate any architectural boundaries from `architecture.md`.
- NFR targets are reflected in acceptance criteria.
- Total estimated complexity is reasonable for the sprint duration.

## Failure Handling

| Failure | Response |
|---------|----------|
| Epic dependencies unmet | Skip epic; select next eligible epic; log blocker in sprint state. |
| Epic too large to slice | Decompose epic into sub-epics; re-run plan workflow for the sub-epics. |
| NFR conflict with sprint scope | Escalate to governance; adjust scope or request NFR waiver. |
| Architecture boundary violation | Reject scope item; flag to governance for architectural guidance. |
| No eligible epics remaining | Sprint workflow completes; signal to plan workflow for re-planning. |
| Task complexity exceeds threshold | Split task into subtasks; reassess sprint capacity. |

## Governance Interaction

- **Reads**: Architecture spec, NFRs, governance rules.
- **Validates**: Sprint scope is checked against architecture boundaries.
- **Checks**: NFRs are reflected in acceptance criteria and test expectations.
- **Escalates**: Scope conflicts or NFR waivers are escalated to governance.

## Context Interaction

- **Context Pack**: `sprint` — loads the selected epic, architecture boundaries, and dependency graph.
- **Context Size**: Medium. Requires epic detail and architectural context but not full codebase.
- **Context Output**: Produces sprint and task specifications consumed by the execute workflow.
- **Context Cleanup**: Sprint artifacts persist in state for the duration of execution and verification.
