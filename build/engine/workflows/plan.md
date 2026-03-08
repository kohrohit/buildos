# Workflow: Plan

## Goal

Convert the project vision and architecture into a concrete roadmap composed of epics, modules, dependency graphs, and milestone targets. This workflow bridges high-level intent with actionable execution by producing structured planning artifacts that downstream workflows consume.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Project vision document | `governance/brain/vision.md` | Yes |
| Architecture specification | `governance/brain/architecture.md` | Yes |
| Existing roadmap (if any) | `state/roadmap.json` | No |
| Technology constraints | `governance/brain/tech-radar.md` | Yes |
| Non-functional requirements | `governance/brain/nfrs.md` | Yes |
| Previous sprint summaries | `state/sprint-history/` | No |

## Steps

### Step 1: Load Governance Brain

Load the full governance brain to establish constraints, standards, and architectural boundaries. The planner must internalize all rules before producing any artifacts.

- Read `governance/brain/vision.md` for project intent and success criteria.
- Read `governance/brain/architecture.md` for system boundaries, layers, and component contracts.
- Read `governance/brain/tech-radar.md` for approved technologies and deprecation schedules.
- Read `governance/brain/nfrs.md` for performance, security, and reliability requirements.
- Read `governance/rules/` for any active governance rules that constrain planning.

### Step 2: Analyze Vision

Decompose the vision into discrete capability areas. For each capability, identify:

- The user-facing value it delivers.
- The technical subsystems it requires.
- The risk profile (complexity, unknowns, external dependencies).
- The priority relative to other capabilities (must-have vs. nice-to-have).

Produce a capability map as an intermediate artifact.

### Step 3: Identify Modules

Map each capability to one or more implementation modules. A module is a cohesive unit of code that can be developed, tested, and deployed semi-independently.

- Name each module with a clear, descriptive identifier.
- Define the module boundary (what it owns, what it delegates).
- Identify the public interface each module exposes.
- Estimate the relative size of each module (S/M/L/XL).

### Step 4: Map Dependencies

Build a dependency graph across all identified modules.

- Identify hard dependencies (module A cannot start until module B is complete).
- Identify soft dependencies (module A benefits from module B but can proceed with mocks).
- Identify external dependencies (third-party APIs, libraries, infrastructure).
- Flag circular dependencies as architectural issues requiring resolution.
- Produce a topological ordering that suggests a valid build sequence.

### Step 5: Propose Epics

Group related modules into epics. Each epic should:

- Deliver a coherent slice of user-facing value.
- Be completable within 2-5 sprints.
- Have clear entry and exit criteria.
- Use the `engine/templates/epic-template.md` format.

If any epic requires an architectural decision not yet captured, draft an ADR proposal for governance review.

### Step 6: Create Roadmap

Assemble epics into a sequenced roadmap.

- Respect the dependency graph from Step 4.
- Front-load high-risk epics to surface unknowns early.
- Balance team capacity across parallel epics.
- Define milestones at natural integration points.
- Produce `state/roadmap.json` with structured epic data.

### Step 7: Get Approval

Present the roadmap for governance review.

- Submit the roadmap to the governance layer for architectural conformance check.
- Flag any proposed ADRs for decision.
- Incorporate feedback and iterate if the roadmap is rejected.
- Upon approval, mark the roadmap as active in `state/roadmap.json`.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Roadmap | `state/roadmap.json` | JSON |
| Epic specifications | `state/epics/` | Markdown (per epic) |
| Dependency graph | `state/dependency-graph.json` | JSON |
| Capability map | `state/capability-map.md` | Markdown |
| ADR proposals (if any) | `governance/adrs/` | Markdown |

## Checks

- Every module is assigned to exactly one epic.
- The dependency graph contains no unresolved circular dependencies.
- Every epic has acceptance criteria defined.
- The roadmap respects all hard dependencies.
- All proposed technologies are approved in `tech-radar.md`.
- NFRs are addressed in at least one epic.

## Failure Handling

| Failure | Response |
|---------|----------|
| Vision document missing or empty | Abort with clear error; planning cannot proceed without vision. |
| Circular dependency detected | Flag to governance layer; propose architectural refactoring in an ADR. |
| Epic too large (>5 sprints estimated) | Split into sub-epics; re-run dependency mapping. |
| Governance rejects roadmap | Log rejection reasons; re-enter at Step 5 with constraints applied. |
| External dependency unavailable | Mark affected epics as blocked; propose alternative in ADR. |

## Governance Interaction

- **Reads**: Full governance brain (vision, architecture, tech-radar, NFRs, rules).
- **Writes**: ADR proposals when architectural decisions are needed.
- **Validates**: Roadmap is checked against architecture for conformance.
- **Escalates**: Unresolved architectural conflicts are escalated to governance for decision.

## Context Interaction

- **Context Pack**: `planning` — loads vision, architecture, and existing roadmap state.
- **Context Size**: Medium. Planning requires broad understanding but not code-level detail.
- **Context Output**: Produces planning artifacts that become inputs for the sprint workflow.
- **Context Cleanup**: Intermediate artifacts (capability map) are retained for auditability.
