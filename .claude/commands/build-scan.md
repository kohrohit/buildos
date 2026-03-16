---
description: "Run security scans — SAST, dependency audit, DAST"
---

# /build-scan — Security Scanning

## Purpose
Run security scans on the project. Can be used anytime — does not require an active sprint.

## Usage
```
/build-scan                              → full SAST + dependency audit
/build-scan --dast http://localhost:3000  → adds DAST
/build-scan --sonar-only                 → just SonarQube
/build-scan --semgrep-only               → just Semgrep
```

## Steps

1. **Detect tools**
   - Call `build-tools.cjs scan detect`
   - Report which tools are available
   - If no scanning tools installed, suggest installation commands and stop

2. **Run scans based on flags**
   - Default (no flags): `build-tools.cjs scan project`
   - `--dast <url>`: also run `build-tools.cjs scan runtime <url>`
   - `--sonar-only`: run `build-tools.cjs scan project --sonar-only`
   - `--semgrep-only`: run `build-tools.cjs scan project --semgrep-only`

3. **Display report**
   - Call `build-tools.cjs scan report`
   - If findings exist, display top 10 by severity
   - Suggest remediation for HIGH/CRITICAL findings

4. **Suggest next steps**
   - If findings need attention: suggest fixing and re-scanning
   - If clean: congratulate and suggest continuing development
   - Remind about `scan dismiss <id> <reason>` for false positives

## Output
```
Security Scan Complete
  Tools: semgrep, npm audit, sonar_scanner
  Posture: moderate

  Findings: 7
    Critical: 0
    High: 2
    Medium: 3
    Low: 2

  Top findings:
    [HIGH] src/routes/api.ts:42 — SQL injection via user input (semgrep)
    [HIGH] package-lock.json:0 — lodash@4.17.20 prototype pollution (npm_audit)
    ...

  Next: Fix HIGH findings, then /build-scan again
```
