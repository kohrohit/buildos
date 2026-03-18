---
description: "Run security scans — SAST, dependency audit, secret detection, data flow, DAST"
---

# /build-scan — Security Scanning

## Purpose
Run security scans on the project. Can be used anytime — does not require an active sprint.

## Tools

| Tool           | Category         | What it does                          |
|----------------|------------------|---------------------------------------|
| Semgrep        | SAST rules       | Pattern-based static analysis         |
| SonarQube      | SAST quality     | Code quality + security issues        |
| CodeQL         | SAST deep        | Semantic data-flow analysis           |
| Trivy          | Dependency scan  | Vulnerabilities + misconfigs          |
| Gitleaks       | Secret scan      | Leaked secrets & credentials          |
| Bearer         | Data flow/privacy| PII exposure & data flow tracking     |
| npm/yarn/pnpm  | Dependency audit | JS/Node.js package vulnerabilities    |
| pip-audit      | Dependency audit | Python package vulnerabilities        |
| govulncheck    | Dependency audit | Go module vulnerabilities             |
| ZAP            | DAST             | Runtime web application scanning      |

## Usage
```
/build-scan                              → full scan (all available tools)
/build-scan --dast http://localhost:3000  → adds DAST runtime scan
/build-scan --semgrep-only               → just Semgrep
/build-scan --sonar-only                 → just SonarQube
/build-scan --codeql-only                → just CodeQL (deep analysis)
/build-scan --trivy-only                 → just Trivy (deps + containers)
/build-scan --gitleaks-only              → just Gitleaks (secrets)
/build-scan --bearer-only                → just Bearer (data flow/privacy)
```

## Steps

1. **Detect tools**
   - Call `build-tools.cjs scan detect`
   - Report which tools are available
   - If no scanning tools installed, suggest installation commands and stop

2. **Run scans based on flags**
   - Default (no flags): `build-tools.cjs scan project` — runs all available tools
   - `--dast <url>`: also run `build-tools.cjs scan runtime <url>`
   - `--<tool>-only`: run `build-tools.cjs scan project --<tool>-only`

3. **Display report**
   - Call `build-tools.cjs scan report`
   - If findings exist, display top 10 by severity
   - Suggest remediation for HIGH/CRITICAL findings

4. **Suggest next steps**
   - If findings need attention: suggest fixing and re-scanning
   - If clean: congratulate and suggest continuing development
   - Remind about `scan dismiss <id> <reason>` for false positives

## Tool Installation

```bash
# SAST
pip install semgrep                        # Semgrep
# SonarQube: download sonar-scanner from sonarqube.org
# CodeQL: gh extension install github/codeql OR download from github.com/github/codeql-cli-binaries

# Dependency & Container scanning
# Trivy:
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Secret detection
# Gitleaks:
brew install gitleaks  # or download from github.com/gitleaks/gitleaks/releases

# Data flow / Privacy
# Bearer:
curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh

# DAST
docker pull ghcr.io/zaproxy/zaproxy:stable  # ZAP via Docker
```

## Output
```
Security Scan Complete
  Tools: semgrep, trivy, gitleaks, bearer, npm_audit
  Posture: moderate

  Findings: 12
    Critical: 1
    High: 3
    Medium: 5
    Low: 3

  Top findings:
    [CRITICAL] .env.production:3 — Secret detected: AWS access key (gitleaks)
    [HIGH] src/routes/api.ts:42 — SQL injection via user input (semgrep)
    [HIGH] src/services/user.ts:88 — [privacy] PII logged without consent (bearer)
    [HIGH] package-lock.json:0 — lodash@4.17.20 prototype pollution (trivy)
    ...

  Next: Fix CRITICAL/HIGH findings, then /build-scan again
```
