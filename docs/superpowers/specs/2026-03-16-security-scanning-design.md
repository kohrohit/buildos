# Security Scanning: SAST, DAST, OWASP & Dependency Audit for BuildOS

**Date:** 2026-03-16
**Version:** v0.4.0 feature
**Status:** Draft
**Approach:** SecurityScanner Manager in build-tools.cjs

## Overview

Adds comprehensive security scanning to BuildOS with dual SAST engines (Semgrep for speed, SonarQube for depth), dependency vulnerability auditing, secrets detection, and optional DAST via OWASP ZAP. Scans integrate at multiple lifecycle points with configurable enforcement posture.

### Problems Solved

- **No automated vulnerability detection:** BuildOS's security-reviewer agent reviews code manually. Real scan data gives it structured findings to work with.
- **Late discovery:** Vulnerabilities found in production are expensive. Per-task scanning during `/build-execute` catches issues at write-time.
- **Dependency blindness:** No visibility into known CVEs in third-party packages.
- **Inconsistent enforcement:** No configurable policy for when vulnerabilities should block vs warn vs log.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SAST tools | Semgrep + SonarQube | Semgrep for fast per-file scans, SonarQube for deep project-level analysis. Complementary. |
| DAST tool | OWASP ZAP (CLI mode) | Free, open-source, industry standard. Opt-in only. |
| Dependency audit | npm audit / pip-audit / govulncheck | Auto-detected by lockfile. No config needed. |
| Secrets detection | Semgrep p/secrets ruleset | Runs on every file scan. No extra tool needed. |
| Enforcement | Configurable posture (strict/moderate/permissive) | Different projects need different thresholds. Set during /build-init. |
| Integration | Direct CLI invocation | No MCP server needed. Tools called via child_process. |
| Graceful degradation | Skip missing tools with warning | Never fail a scan because a tool isn't installed. |
| SonarQube token | Environment variable only | Never stored in state files. sonarqube_token_env records which env var to read. |

---

## 1. SecurityScanner Manager

New manager added to `build-tools.cjs` after MergeValidator, before Hooks section.

### Tool Detection

On first run (or via `scan detect`), checks which tools are installed:

```javascript
// Detection commands
semgrep: 'semgrep --version'
sonar_scanner: 'sonar-scanner --version'
zap: 'docker ps' (preferred) || 'zap.sh -version' (fallback)
npm_audit: 'npm --version'
yarn_audit: 'yarn --version'
pnpm_audit: 'pnpm --version'
pip_audit: 'pip-audit --version'
govulncheck: 'govulncheck -version'
```

Results stored in `state/scan-state.json` under `tools`. Re-detected on `scan detect` or when a tool command fails.

### Methods

| Method | Purpose |
|--------|---------|
| `detectTools()` | Check installed tools, save to state |
| `scanFiles(files)` | Semgrep scan on specific files (per-task, fast) |
| `scanProject()` | Full SAST (Semgrep + SonarQube) + dependency audit |
| `scanRuntime(url)` | DAST via OWASP ZAP against target URL |
| `runSemgrep(target, rulesets)` | Execute semgrep with specified rulesets, parse JSON output |
| `runSonarQube()` | Trigger sonar-scanner, poll for completion, fetch results via API |
| `runDependencyAudit()` | Auto-detect lockfiles, run appropriate audit tool(s) |
| `runZap(url)` | OWASP ZAP quick scan, parse report |
| `applyPosture(findings)` | Apply severity thresholds based on security posture |
| `getReport()` | Generate human-readable scan summary |
| `configure(posture)` | Set security posture in project state |
| `configureSonarQube(url, projectKey)` | Store SonarQube connection details |

### Severity Mapping

All tools map to a unified severity scale:

| Unified | Semgrep | SonarQube | npm/yarn/pnpm audit | ZAP |
|---------|---------|-----------|---------------------|-----|
| critical | ERROR | BLOCKER | critical | High |
| high | WARNING + rule metadata `severity: high` | CRITICAL | high | Medium |
| medium | WARNING + rule metadata `severity: medium` | MAJOR | moderate | Low |
| low | INFO | MINOR | low | Informational |

**Semgrep disambiguation:** Semgrep's CLI severity (ERROR/WARNING/INFO) is coarse. The actual severity comes from the rule's metadata `severity` field in the JSON output (`result.extra.severity`). Use `extra.metadata.impact` or `extra.metadata.confidence` as secondary signals when available. Map: `extra.severity === "ERROR"` → critical, `extra.severity === "WARNING"` + `extra.metadata.impact === "HIGH"` → high, otherwise → medium.

**Cross-tool deduplication:** When both Semgrep and SonarQube report a finding on the same file+line with the same CWE, keep the SonarQube finding (richer metadata) and discard the Semgrep duplicate. Deduplication key: `(file, line, cwe)`. Findings without CWE are never deduplicated.

### Security Posture

Set during `/build-init`, stored in `current-project.json`:

| Posture | CRITICAL | HIGH | MEDIUM | LOW |
|---------|----------|------|--------|-----|
| strict | Block | Block | Warn | Log |
| moderate | Warn | Warn | Log | Log |
| permissive | Log | Log | Log | Log |

"Block" means the task/review fails. "Warn" means findings are reported prominently but don't block. "Log" means findings are recorded in scan-state.json only.

**Posture vs. governance precedence:** The security posture sets the *automated scan* thresholds. The existing review governance rules (e.g., "HIGH/CRITICAL block approval") apply to the *security-reviewer agent's manual assessment*. These are independent — a `moderate` posture won't auto-block, but the human security reviewer can still block based on their judgment. Automated scan posture never overrides governance; it controls whether the scan itself blocks the workflow step.

### Finding Lifecycle

Findings have a `status` field: `open` → `resolved` | `dismissed` | `false_positive`

- **open**: newly detected, not yet addressed
- **resolved**: the vulnerable code was fixed (auto-detected when the file+line no longer triggers the rule on re-scan)
- **dismissed**: user explicitly dismissed via `scan dismiss <id> <reason>`
- **false_positive**: user marked as false positive via `scan dismiss <id> --false-positive <reason>`

Dismissed/false_positive findings are excluded from severity counts and posture enforcement. They remain in scan-state.json for audit trail. A `scan dismiss` subcommand is required (added to CLI table in Section 4).

### Task Status on Security Block

When posture=strict and a HIGH/CRITICAL finding blocks a task during `/build-execute`:
- Task status is set to `blocked_by_security` in task-state.json
- The executor stops work on that task
- Findings are recorded in task state with file and line references
- User can fix the code and re-run `/build-execute` — the task returns to `pending`
- Alternatively, user can `scan dismiss <id>` if it's a false positive, then re-run

---

## 2. Lifecycle Integration

### During `/build-execute` (per-task, lightweight)

After the executor writes code and before the task is marked complete, a security scan step runs as part of the executor's self-validation (Step 5 in execute workflow — between implementation and state update). This is NOT a hook — it's an inline step in the execute command flow, triggered by the `/build-execute` command prompt:

1. Collect files from task's `file_scope` (or `files_modified` from task state)
2. Run `SecurityScanner.scanFiles(files)` — Semgrep only, rulesets: `p/owasp-top-ten` + `p/secrets`
3. Parse findings, apply posture
4. If posture=strict and HIGH/CRITICAL found → task fails, findings in task state
5. If warn → findings appended to task state, execution continues
6. If log → findings written to scan-state.json silently

Estimated time: 1-2 seconds per task. No SonarQube at this stage.

### During `/build-review` (full project, thorough)

Before dispatching the security-reviewer agent:

1. Run `SecurityScanner.scanProject()`:
   - Semgrep full project: `p/owasp-top-ten` + `p/security-audit` + `p/secrets`
   - SonarQube scan (if configured): trigger scan, poll, fetch issues
   - Dependency audit: auto-detect lockfiles, run appropriate tools
2. Write all findings to `state/scan-state.json`
3. Generate scan summary
4. Inject findings into the security-reviewer agent's context pack (blind review pack)
5. Security reviewer now has structured scan data alongside the code

The security-reviewer agent's prompt gets a new section:

```
## Scan Findings
The following vulnerabilities were detected by automated scanning tools:

{findings from scan-state.json, formatted as table}

Cross-reference these findings with your manual code review. Flag any that the
scanners missed. Assess whether scanner findings are true positives or false positives.
```

### During `/build-verify` (DAST, opt-in)

Only when `--dast <url>` flag is provided:

1. Verify ZAP is installed (`scan detect`)
2. Run `SecurityScanner.scanRuntime(url)` — OWASP ZAP quick scan
3. Results added to scan-state.json
4. Findings included in verify report

Most sprints skip this. Only relevant when the sprint produces a running service.

### Standalone `/build-scan`

Runs the full scan suite without needing an active sprint:

```
/build-scan                              → full SAST + dependency audit
/build-scan --dast http://localhost:3000  → adds DAST
/build-scan --sonar-only                 → just SonarQube
/build-scan --semgrep-only               → just Semgrep
```

---

## 3. State Schema

### New: state/scan-state.json

```json
{
  "tools": {
    "semgrep": { "available": true, "version": "1.56.0" },
    "sonar_scanner": { "available": true, "version": "5.0.1" },
    "zap": { "available": true, "method": "docker", "version": "2.14.0" },
    "npm_audit": { "available": true, "version": null },
    "yarn_audit": { "available": false, "version": null },
    "pnpm_audit": { "available": false, "version": null },
    "pip_audit": { "available": false, "version": null },
    "govulncheck": { "available": false, "version": null }
  },
  "posture_source": "current-project.json",
  "sonarqube_source": "current-project.json",
  "last_scan": {
    "type": "project",
    "timestamp": "2026-03-16T10:00:00Z",
    "tools_used": ["semgrep", "sonar_scanner", "npm_audit"],
    "summary": {
      "critical": 0,
      "high": 2,
      "medium": 5,
      "low": 12
    }
  },
  "findings": [
    {
      "id": "F-001",
      "tool": "semgrep",
      "rule": "javascript.express.security.audit.xss.mustache-escape",
      "severity": "high",
      "file": "src/routes/api.ts",
      "line": 42,
      "message": "Unescaped user input in template",
      "cwe": "CWE-79",
      "owasp": "A7:2017",
      "status": "open",
      "found_at": "2026-03-16T10:00:00Z",
      "sprint_id": "S-001"
    }
  ],
  "scan_history": [
    {
      "timestamp": "2026-03-16T10:00:00Z",
      "type": "files",
      "files_scanned": 3,
      "findings_count": 1,
      "tools_used": ["semgrep"]
    }
  ]
}
```

### Modified: state/current-project.json

Adds security configuration (set during `/build-init`):

```json
{
  "security": {
    "posture": "moderate",
    "sonarqube_url": null,
    "sonarqube_project_key": null,
    "sonarqube_token_env": "SONAR_TOKEN"
  }
}
```

SonarQube token is NEVER stored in state files. The `sonarqube_token_env` field records which environment variable to read (default: `SONAR_TOKEN`).

---

## 4. CLI Subcommands & Command Interface

### New CLI subcommands in build-tools.cjs

| Command | Purpose | Output |
|---------|---------|--------|
| `scan detect` | Detect installed security tools | JSON: tool availability + versions |
| `scan files <file1> [file2...]` | Semgrep scan on specific files | JSON: findings |
| `scan project` | Full SAST + dependency audit | JSON: summary + findings |
| `scan runtime <url>` | DAST via OWASP ZAP | JSON: findings |
| `scan report` | Human-readable scan summary | Report text |
| `scan configure <posture>` | Set posture (strict/moderate/permissive) | Confirmation |
| `scan sonarqube <url> <project-key>` | Configure SonarQube connection | Confirmation |
| `scan history` | Show scan history | JSON: past scans |
| `scan dismiss <id> [--false-positive] <reason>` | Dismiss a finding or mark as false positive | Confirmation |

### New slash command: /build-scan

New file `build/commands/build-scan.md`:

```markdown
## Purpose
Run security scans on the project. Can be used anytime — does not require an active sprint.

## Usage
/build-scan                              → full SAST + dependency audit
/build-scan --dast http://localhost:3000  → adds DAST
/build-scan --sonar-only                 → just SonarQube
/build-scan --semgrep-only               → just Semgrep

## Steps
1. Call `build-tools.cjs scan detect` to verify tool availability
2. Based on flags, call appropriate scan subcommand
3. Call `build-tools.cjs scan report` to display results
4. If any HIGH/CRITICAL findings, suggest remediation
```

### Modified /build-init

Adds security posture question to initialization flow:

```
Security Posture:
  What security enforcement level for this project?

  1. strict     — HIGH/CRITICAL block tasks, MEDIUM warns
  2. moderate   — HIGH/CRITICAL warn, rest logged (default)
  3. permissive — everything logged, nothing blocks

  Optional: SonarQube server URL? (press Enter to skip)
  Optional: SonarQube project key? (press Enter to skip)
```

### Modified /build-review

Before dispatching security-reviewer agent:

```
1. Run build-tools.cjs scan project
2. Read findings from scan-state.json
3. Include findings summary in the security-reviewer's context pack
4. Security reviewer cross-references scan findings with manual review
```

### Modified /build-verify

Adds optional `--dast` flag:

```
/build-verify                              → standard verification
/build-verify --dast http://localhost:3000  → adds DAST scan
```

---

## 5. Tool Invocation Details

### Semgrep (SAST)

```javascript
// Per-file scan (during execute)
execSync(`semgrep --config p/owasp-top-ten --config p/secrets --json --quiet ${files.join(' ')}`, { timeout: 30000 })

// Full project scan (during review/scan)
execSync(`semgrep --config p/owasp-top-ten --config p/security-audit --config p/secrets --json --quiet .`, { timeout: 120000 })
```

Semgrep outputs JSON with rule ID, severity, CWE, OWASP category, file, line, message. Parsed directly into findings array.

### SonarQube

```javascript
// 1. Trigger scan via sonar-scanner CLI
execSync(`sonar-scanner -Dsonar.projectKey=${projectKey} -Dsonar.host.url=${serverUrl} -Dsonar.token=${token}`, { timeout: 300000 })

// 2. Poll for analysis completion
// GET ${serverUrl}/api/ce/component?component=${projectKey}
// Wait until task.status === 'SUCCESS'

// 3. Fetch vulnerability issues
// GET ${serverUrl}/api/issues/search?componentKeys=${projectKey}&severities=BLOCKER,CRITICAL,MAJOR&types=VULNERABILITY,BUG&ps=500
```

SonarQube scan takes 30-60 seconds. The scanner polls the task queue (max 5 minutes timeout) then fetches issues via REST API. Token read from environment variable specified in config.

If SonarQube is not configured or server is unreachable, scan is skipped with warning — never fails.

### Dependency Audit (auto-detected)

```javascript
// Detect by lockfile presence — use the correct audit tool for each package manager
if (exists('package-lock.json'))
  → execSync('npm audit --json', { timeout: 60000 })

if (exists('yarn.lock'))
  → execSync('yarn audit --json', { timeout: 60000 })

if (exists('pnpm-lock.yaml'))
  → execSync('pnpm audit --json', { timeout: 60000 })

if (exists('requirements.txt') || exists('Pipfile') || exists('pyproject.toml'))
  → execSync('pip-audit --format json', { timeout: 60000 })

if (exists('go.sum'))
  → execSync('govulncheck -json ./...', { timeout: 60000 })
```

Multiple lockfiles = multiple tools run. All results merged into unified findings array.

### OWASP ZAP (DAST)

**Note:** `zap-cli` (Python package) is deprecated. Use ZAP's built-in CLI or Docker image instead.

```javascript
// Option 1: ZAP CLI (if zap.sh is on PATH)
execSync(`zap.sh -cmd -quickurl ${targetUrl} -quickout ${reportPath} -quickprogress`, { timeout: 600000 })

// Option 2: ZAP Docker (if Docker is available, preferred — no local install needed)
execSync(`docker run --rm -v /tmp:/zap/wrk ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${targetUrl} -J ${reportName}`, { timeout: 600000 })
```

Detection order: try Docker first (`docker ps` succeeds), fall back to `zap.sh -version`, skip if neither available.

ZAP is the heaviest tool (~2-5 minutes). Only runs when explicitly requested via `--dast`.

### Graceful Degradation

If a tool isn't installed, it's skipped with a warning — never fails the scan:

```
Security Tools:
  ✓ semgrep 1.56.0
  ✓ npm audit
  ✗ sonar-scanner — run: brew install sonar-scanner
  ✗ zap — run: docker pull ghcr.io/zaproxy/zaproxy:stable (or brew install zaproxy)
  ✗ pip-audit — not needed (no Python lockfile detected)
  ✗ govulncheck — not needed (no Go lockfile detected)
```

Tools marked "not needed" are those where no matching lockfile/project type was detected.

### Partial Scan Failure Handling

If an installed tool fails mid-scan (crash, network error, timeout):

| Scenario | Behavior |
|----------|----------|
| Semgrep crashes on a file | Log error, skip that file, continue with remaining files. Report includes "N files skipped due to errors." |
| SonarQube API returns 500 | Log warning, skip SonarQube results. Semgrep + dependency results still reported. |
| npm/yarn/pnpm audit network error | Log warning, skip dependency audit. SAST results still reported. |
| ZAP timeout (>10 min) | Kill process, report partial results if available. |

The scan never fails entirely because one tool errored. Partial results are always better than no results. The scan report includes a `tools_errored` array listing which tools failed and why.

### SonarQube Polling

Poll interval: 3 seconds with linear backoff (+1 second per poll, max 10 seconds). Maximum wait: 5 minutes. If analysis doesn't complete in 5 minutes, skip SonarQube results with warning.

### Scan History Retention

Maximum 50 entries in `scan_history`. Oldest entries are pruned when the limit is reached. Findings are pruned when their source sprint is archived (via `/build-learn`).

---

## 6. Files Changed / Created

### Modified

| File | Change |
|------|--------|
| `build/bin/build-tools.cjs` | +SecurityScanner manager, +scan CLI subcommands, +STATE_FILES entry (~500-600 lines) |
| `build/commands/build-init.md` | +Security posture question, +SonarQube config prompt |
| `build/commands/build-review.md` | +Run scan project before security-reviewer, inject findings |
| `build/commands/build-verify.md` | +Optional `--dast` flag with target URL |
| `build/commands/build-execute.md` | +Security scan step in self-validation phase (Step 5), calls `scan files` on modified files |
| `build/context/templates/review-pack.md` | +Scan findings inclusion in security-reviewer context |
| `build/governance/agents/security-reviewer.md` | +Section on using structured scan findings in review |

### New

| File | Purpose |
|------|---------|
| `build/commands/build-scan.md` | Standalone scan command definition |
| `.claude/commands/build-scan.md` | Slash command for Claude Code |
| `build/state/scan-state.json` | Scan findings, tool availability, history |

### Unchanged

| File | Reason |
|------|--------|
| Ralph Loop files | Independent feature |
| Learning system | Unrelated |
| Other governance files | Read-only, unaffected |
