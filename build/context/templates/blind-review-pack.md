# Blind Review Context Pack

## Purpose

Assembles context for **isolated, unbiased review** by agents that have NO knowledge
of how the code was written. This pack deliberately strips implementation reasoning,
mid-sprint decisions, blocker resolutions, and execution context. The reviewer sees
only what was promised (spec) and what exists (code) — never why choices were made.

## When to Use

Use this pack instead of `review-pack.md` when spawning review agents with
`isolation: "worktree"` to ensure independent, unbiased evaluation.

## Included Context

| Order | Source | What to Include | What to Strip |
|---|---|---|---|
| 1 | Sprint spec | User stories, acceptance criteria, API contracts, data models | Mid-sprint scope changes, blocker notes, compromise rationale |
| 2 | Governance rules | All applicable coding standards from `governance/rules/` | Nothing — rules are objective |
| 3 | Architecture spec | Module boundaries, dependency rules, ADRs | Nothing — architecture is objective |
| 4 | NFRs | Performance, security, reliability thresholds | Nothing — thresholds are objective |
| 5 | Code on disk | All files modified during sprint (read fresh from filesystem) | Git commit messages (they contain reasoning) |
| 6 | Test results | Raw pass/fail output from test runner | Nothing — results are objective |

## Explicitly Excluded

These are excluded **by design** to prevent bias:

- `sprint-state.json` decisions, reasoning, and blocker fields
- Task-level notes explaining *why* something was done a certain way
- Previous review findings (prevents anchoring to prior assessments)
- Learned patterns from this sprint (reviewer should find patterns independently)
- Any conversation history or execution context
- Git commit messages (they reveal intent and justify shortcuts)

## Assembly Instructions

1. Read sprint spec from `state/sprints/{sprint-id}.md`
2. Extract ONLY: user stories, acceptance criteria, API contracts, data models, test cases
3. Do NOT include: "Technical approach", "Design decisions", or any narrative sections
4. Load governance rules via `load-rules.md`
5. Load architecture and NFRs via `load-governance.md`
6. Identify modified files from git diff (filenames only, not commit messages)
7. Let the reviewer read the actual code fresh from the filesystem
8. Run test suite and provide raw output

## Token Budget

| Layer | Budget |
|---|---|
| Sprint spec (stripped) | 1200 tokens |
| Governance rules | 1000 tokens |
| Architecture + NFRs | 1500 tokens |
| File list (modified) | 300 tokens |
| Test results (raw) | 500 tokens |
| **Total** | **4500 tokens** |
| **Hard ceiling** | **6000 tokens** |

Note: Budget is smaller than `review-pack.md` because we exclude reasoning context.
The reviewer reads code directly from disk, which doesn't count against the pack budget.

## Reviewer Mandate

Every agent receiving this pack MUST be given this preamble:

> You are reviewing code you have never seen before. You have no knowledge of how
> or why it was written. You do not know what challenges the author faced, what
> trade-offs they considered, or what shortcuts they took. Judge the code solely
> on what it does, how it does it, and whether it meets the specification. Your
> job is to find what is wrong, not to confirm what is right.
