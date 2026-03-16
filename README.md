# BuildOS

The operating system for AI-powered software development.

**[View the AI-SDLC Strategic Framework →](https://kohrohit.github.io/buildos/ai-sdlc-framework.html)**

Combines always-active governance (standards, specialist agents, quality hooks, project memory) with sprint-based execution (plan, execute, verify, learn), wave-based parallel execution, integrated security scanning, and intelligent context engineering — all through a single `/build:*` command interface for Claude Code.

## Features

- **Three-Layer Architecture** — Governance (permanent) → Context (orchestrator) → Execution (sprint-scoped)
- **13 Slash Commands** — Full lifecycle from init to learn
- **Wave-Based Parallel Execution** — DAG decomposition, isolated worktrees, execution ledger sync
- **Security Scanning** — Dual SAST (Semgrep + SonarQube), dependency audit, DAST (OWASP ZAP), configurable posture
- **Document Ingestion** — Feed SRS, architecture docs, presentations, diagrams into the project brain
- **7 Specialist Agents** — Architect, Security, Backend, Code Review, QA, Docs, Platform — model-routed for cost
- **Trust-Tiered Learning** — Patterns with confidence scoring, TTL, approval gates, 50-pattern cap
- **Context Engineering** — Token-budgeted packs, freshness policies, compression, zero context rot

## Quick Start

```bash
# One-liner install into any project
curl -sL https://raw.githubusercontent.com/kohrohit/buildos/main/install.sh | bash

# Or manual
git clone https://github.com/kohrohit/buildos.git .buildos-tmp
cp -r .buildos-tmp/build ./build
mkdir -p .claude/commands
cp .buildos-tmp/.claude/commands/*.md .claude/commands/
cp .buildos-tmp/.claude/settings.json .claude/settings.json
rm -rf .buildos-tmp
```

Then open Claude Code and run:

```
/build-init MyProject "A task management API"
/build-init MyProject "A task management API" --docs ./project-docs/
```

## Commands

| Command | Purpose |
|---------|---------|
| `/build-init` | Bootstrap project brain, seed governance, configure security |
| `/build-plan` | Architecture discovery, epic decomposition, roadmap |
| `/build-sprint` | Define sprint scope, tasks, acceptance criteria |
| `/build-execute` | Execute tasks (sequential or `--parallel` for wave-based) |
| `/build-verify` | Blind verification against acceptance criteria (`--dast` for DAST) |
| `/build-review` | Isolated specialist agent reviews with scan findings |
| `/build-learn` | Compress sprint, extract patterns, record ADRs |
| `/build-status` | Dashboard — roadmap, sprint, tasks, blockers, learning health |
| `/build-scan` | On-demand security scan (SAST, dependency audit, DAST) |
| `/build-ingest` | Analyze logs, extract candidate patterns |
| `/build-audit` | Review staged patterns, manage expiring patterns |
| `/build-remember` | Save explicit teaching as high-trust pattern |

## Architecture

```
build/
├── bin/build-tools.cjs        # CLI — state, context, orchestration (~3,000 lines)
├── governance/                # Permanent: brain, agents, rules, hooks
├── engine/                    # Sprint workflows, task agents, templates
├── context/                   # Context packs, policies, loaders, summaries
├── learning/                  # Pattern lifecycle, staging, analysis
├── commands/                  # Slash command definitions
└── state/                     # Runtime JSON state files
```

## Author

**Rohit Kohli** — [kohrohit@gmail.com](mailto:kohrohit@gmail.com) — [github.com/kohrohit](https://github.com/kohrohit)
