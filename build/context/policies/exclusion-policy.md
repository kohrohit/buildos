# Exclusion Policy

## Purpose

Defines what context must NEVER be loaded in specific situations. Excluding
irrelevant context is as important as including relevant context — unnecessary
context wastes token budget, introduces confusion, and can cause the agent to
make decisions based on outdated or inapplicable information.

## Universal Exclusions

These are never loaded regardless of phase:

| Excluded Content | Reason |
|---|---|
| Rejected ADRs (`status: rejected`) | They represent paths not taken |
| Build artifacts (`dist/`, `build/`, `node_modules/`) | Generated, not authored |
| Environment files (`.env`, `.env.*`) | Security risk, runtime-specific |
| Lock files (`package-lock.json`, `yarn.lock`) | Too large, not human-authored |
| Binary files and media assets | Not processable as context |
| IDE configuration (`.vscode/`, `.idea/`) | User-specific, not project context |

## Phase-Specific Exclusions

### During Planning

| Excluded | Reason | Load Instead |
|---|---|---|
| Raw code files | Too detailed for planning scope | Module summaries |
| Test file contents | Implementation detail | Test coverage summaries |
| Sprint task lists from past sprints | Stale granular data | Sprint summaries |
| Module internals | Wrong abstraction level | Architecture overview |

### During Execution

| Excluded | Reason | Load Instead |
|---|---|---|
| Unrelated module internals | Noise, budget waste | Nothing — skip entirely |
| Completed sprint specs | Past scope, not current | Sprint summaries if needed |
| Vision document | Already internalized in sprint spec | Sprint spec |
| Full project history | Too broad for focused coding | Relevant module history |

### During Review

| Excluded | Reason | Load Instead |
|---|---|---|
| Implementation alternatives not chosen | Distracting | Active ADR decisions |
| Past sprint blockers (resolved) | No longer relevant | Current sprint state |
| Modules not modified in this sprint | Out of review scope | Nothing |
| Draft documentation | Not yet authoritative | Approved docs only |

## Exclusion Decision Examples

### Example 1: Developer working on auth module
- **Include**: `auth` module context, auth-related ADRs, TypeScript rules
- **Exclude**: `payments` module internals, Python rules, database migration history
- **Why**: Auth task has no dependency on payments; only TS files are being touched

### Example 2: Sprint planning for Sprint-05
- **Include**: Sprint-03 and Sprint-04 summaries, project summary, learned patterns
- **Exclude**: Sprint-01 raw details, Sprint-02 raw details, Sprint-03 raw details
- **Why**: Raw details from 2+ sprints ago are compressed into summaries

### Example 3: Reviewing a PR that adds a new API endpoint
- **Include**: API module context, architecture (API layer), NFRs, coding rules
- **Exclude**: Frontend module context, CI/CD configuration, historical git blame
- **Why**: Review scope is the API change; frontend and infra are separate concerns

### Example 4: Mid-sprint, task is blocked
- **Include**: Current sprint state, blocker details, related module context
- **Exclude**: Other teams' sprint data, resolved blockers from past sprints
- **Why**: Focus on unblocking the current issue, not historical blockers

## Staleness Exclusions

Context becomes excludable based on age:

| Content Type | Stale After | Action |
|---|---|---|
| Raw sprint details | Sprint completion | Compress to summary, exclude raw |
| Sprint summaries | 3 sprint cycles | Archive into project summary |
| Research reports | 3 sprint cycles | Exclude unless explicitly requested |
| Module summaries | 2 sprints without updates | Flag for refresh, still loadable |
| Learned patterns | Never auto-stale | Prune only when contradicted |

## Enforcement

- Before loading any context, check it against exclusion rules
- If excluded content is requested explicitly by the user, warn but comply
- Log exclusion decisions for debugging context assembly issues
- Exclusion rules override inclusion rules when they conflict — if a file matches
  both an inclusion and an exclusion rule, exclude it and log the conflict
