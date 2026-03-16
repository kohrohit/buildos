# BuildOS v0.3.0 Release Notes

**Date:** 2026-03-16
**Author:** Rohit Kohli <kohrohit@gmail.com>

---

## What's New

### Ralph Loop — Wave-Based Parallel Execution

Sprint tasks with independent dependencies now execute in parallel via `/build-execute --parallel`.

- **DAG decomposition** — tasks are topologically sorted into waves. Independent tasks run concurrently in isolated git worktrees.
- **Execution ledger** — shared context between waves. Decisions, interfaces, and warnings from completed waves carry forward to the next.
- **Merge validation** — file-conflict detection prevents two units from touching the same file. Conflicts are treated as DAG bugs with actionable fix suggestions.
- **Tier classification** — tasks auto-classified into Tier 1 (Sonnet), Tier 2 (Sonnet), Tier 3 (Opus) based on keywords and file scope. Cost visibility before execution.
- **Isolate-and-continue** — failed units are evicted and snapshotted. Unaffected work continues. DAG recalculates automatically.
- **Concurrency cap** — default 4 agents per wave, configurable via `--max-agents N`.

**New CLI subcommands:** `dag build|tier|recalculate`, `ledger init|read|update|finalize|cleanup`, `merge validate`

### Security Scanning — SAST, DAST, Dependency Audit

Comprehensive security scanning integrated at multiple lifecycle points.

- **Dual SAST engines** — Semgrep (fast, per-task during execute) + SonarQube (deep, full project during review). Complementary coverage.
- **Dependency audit** — auto-detects package manager (npm/yarn/pnpm/pip/govulncheck) and runs the correct audit tool.
- **DAST** — OWASP ZAP via Docker or standalone, opt-in via `/build-verify --dast <url>`.
- **Secrets detection** — Semgrep `p/secrets` ruleset runs on every file scan.
- **Configurable posture** — strict (blocks on HIGH), moderate (warns), permissive (logs only). Set during `/build-init`.
- **Finding lifecycle** — open, resolved (auto-detected on re-scan), dismissed, false_positive. `scan dismiss` command for manual triage.
- **Cross-tool deduplication** — findings from Semgrep and SonarQube on same file+line+CWE are deduplicated. SonarQube preferred for richer metadata.
- **Graceful degradation** — missing tools are skipped with warnings, never fail the scan.
- **SonarQube integration** — trigger scan, poll with linear backoff, fetch issues via REST API. Token read from environment variable only.

**New command:** `/build-scan` (standalone, anytime)
**New CLI subcommands:** `scan detect|files|project|runtime|report|configure|sonarqube|history|dismiss`

### Document Ingestion — /build-init --docs

Supply project literature during initialization. BuildOS reads your documents and populates the brain intelligently.

```
/build-init MyApp "A task API" --docs ./project-docs/
```

- **19 supported file types** — PDF, DOCX, PPTX, YAML, JSON (OpenAPI), PlantUML, Mermaid, Markdown, images (PNG/JPG/SVG), Figma URLs, plain text.
- **Zero information loss** — full text extracted and saved to `governance/brain/sources/`. No truncation, no summarization.
- **Split execution model** — text-based formats (MD, DOCX, PPTX, YAML) extracted by Node.js. PDFs and images read by Claude directly (multimodal).
- **Gap-based Q&A** — after reading documents, architecture discovery only asks about topics NOT covered. Shorter, smarter initialization.
- **Backward compatible** — no `--docs` flag = today's behavior, unchanged.

**New CLI subcommands:** `docs scan|extract|populate`

---

## Breaking Changes

None. All features are additive. Existing workflows are unchanged.

---

## Stats

| Metric | Value |
|--------|-------|
| Commits | 27 |
| New lines of code | ~1,440 |
| build-tools.cjs | 1,590 → ~3,030 lines |
| New managers | 4 (DAGBuilder, LedgerManager, MergeValidator, SecurityScanner, DocumentProcessor) |
| New CLI subcommands | 22 |
| New slash commands | 1 (/build-scan) |
| Modified slash commands | 4 (/build-execute, /build-init, /build-review, /build-verify) |
| New state files | 2 (execution-ledger.json, scan-state.json) |
| Specs written | 3 |
| Plans written | 3 |

---

## Upgrade Guide

1. Copy the updated `build/` directory to your project
2. Copy `.claude/commands/*.md` to get new slash commands
3. Run `node build/bin/build-tools.cjs scan detect` to check security tool availability
4. Optionally install Semgrep: `pip install semgrep`
5. Optionally configure SonarQube: `node build/bin/build-tools.cjs scan sonarqube <url> <key>`

---

## What's Next (v0.4.0)

- Live plugin testing and stabilization
- File-scope enforcement in parallel execution (post-merge validation)
- `dag suggest-fix` for automatic dependency repair on merge conflicts
- Scan findings dashboard in `/build-status`
