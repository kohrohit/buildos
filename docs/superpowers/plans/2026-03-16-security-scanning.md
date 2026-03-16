# Security Scanning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SAST (Semgrep + SonarQube), dependency audit, secrets detection, and DAST (OWASP ZAP) to BuildOS with configurable enforcement posture.

**Architecture:** SecurityScanner manager added to build-tools.cjs with CLI subcommands. Scans integrate at execute (per-file Semgrep), review (full project), verify (opt-in DAST), and standalone (/build-scan). Security posture (strict/moderate/permissive) controls block vs warn vs log thresholds.

**Tech Stack:** Node.js (CJS), Semgrep CLI, sonar-scanner CLI, OWASP ZAP (Docker or zap.sh), npm/yarn/pnpm audit, pip-audit, govulncheck

**Spec:** `docs/superpowers/specs/2026-03-16-security-scanning-design.md`

---

## Chunk 1: SecurityScanner Core (Tool Detection + Semgrep)

### Task 1: Add scan state to STATE_FILES and constants

**Files:**
- Modify: `build/bin/build-tools.cjs` (STATE_FILES constant, ~line 19)

- [ ] **Step 1: Add scan state file entry**

Add `scan: 'scan-state.json'` to STATE_FILES:

```javascript
const STATE_FILES = {
  project: 'current-project.json',
  roadmap: 'roadmap.json',
  sprint: 'sprint-state.json',
  task: 'task-state.json',
  context: 'context-state.json',
  patterns: 'learned-patterns.json',
  staging: 'staging-patterns.json',
  ledger: 'execution-ledger.json',
  scan: 'scan-state.json',
};
```

- [ ] **Step 2: Add severity constants**

Add after the TIER keywords constants (search for `const TIER2_KEYWORDS`), add:

```javascript
// ---------------------------------------------------------------------------
// Security scanning constants
// ---------------------------------------------------------------------------

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

const POSTURE_THRESHOLDS = {
  strict:     { critical: 'block', high: 'block', medium: 'warn', low: 'log' },
  moderate:   { critical: 'warn',  high: 'warn',  medium: 'log',  low: 'log' },
  permissive: { critical: 'log',   high: 'log',   medium: 'log',  low: 'log' },
};

const SEMGREP_RULESETS = {
  quick: ['p/owasp-top-ten', 'p/secrets'],
  full:  ['p/owasp-top-ten', 'p/security-audit', 'p/secrets'],
};
```

- [ ] **Step 3: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add scan state and security constants"
```

---

### Task 2: Implement SecurityScanner — tool detection

**Files:**
- Modify: `build/bin/build-tools.cjs` (insert after MergeValidator, before Hooks)

- [ ] **Step 1: Add SecurityScanner with detectTools and helpers**

Search for the Hooks section comment (`// ---------------------------------------------------------------------------` after MergeValidator). Insert before it:

```javascript
// ---------------------------------------------------------------------------
// SecurityScanner — SAST, DAST, dependency audit, secrets detection
// ---------------------------------------------------------------------------

const { execSync: _execSyncRaw } = require('child_process');

const SecurityScanner = {
  _scanPath() {
    return stateFile('scan');
  },

  _loadScanState() {
    return loadJSON(this._scanPath()) || {
      tools: {},
      posture_source: 'current-project.json',
      sonarqube_source: 'current-project.json',
      last_scan: null,
      findings: [],
      scan_history: [],
    };
  },

  _saveScanState(state) {
    saveJSON(this._scanPath(), state);
  },

  _getPosture() {
    const project = loadState('project');
    return (project?.security?.posture) || 'moderate';
  },

  _getSonarConfig() {
    const project = loadState('project');
    return project?.security || {};
  },

  _exec(cmd, opts) {
    try {
      return _execSyncRaw(cmd, { encoding: 'utf-8', timeout: opts?.timeout || 30000, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    } catch (err) {
      return null;
    }
  },

  _execOrError(cmd, opts) {
    try {
      return { output: _execSyncRaw(cmd, { encoding: 'utf-8', timeout: opts?.timeout || 30000, stdio: ['pipe', 'pipe', 'pipe'], ...opts }), error: null };
    } catch (err) {
      return { output: null, error: err.message || 'unknown error' };
    }
  },

  _genFindingId() {
    return genId('F');
  },

  // ---- Tool Detection ----

  detectTools() {
    const tools = {};

    // Semgrep
    const semgrepVer = this._exec('semgrep --version');
    tools.semgrep = { available: !!semgrepVer, version: semgrepVer?.trim() || null };

    // SonarQube scanner
    const sonarVer = this._exec('sonar-scanner --version 2>&1');
    tools.sonar_scanner = {
      available: !!sonarVer && sonarVer.includes('SonarScanner'),
      version: sonarVer ? (sonarVer.match(/SonarScanner ([\d.]+)/)?.[1] || null) : null,
    };

    // ZAP — try Docker first, then zap.sh
    const dockerAvail = this._exec('docker ps', { timeout: 5000 });
    const zapShAvail = this._exec('zap.sh -cmd -version 2>&1', { timeout: 10000 });
    tools.zap = {
      available: !!(dockerAvail || zapShAvail),
      method: dockerAvail ? 'docker' : (zapShAvail ? 'zap.sh' : null),
      version: null,
    };

    // Package manager audit tools
    tools.npm_audit = { available: !!this._exec('npm --version'), version: null };
    tools.yarn_audit = { available: !!this._exec('yarn --version'), version: null };
    tools.pnpm_audit = { available: !!this._exec('pnpm --version'), version: null };
    tools.pip_audit = { available: !!this._exec('pip-audit --version'), version: null };
    tools.govulncheck = { available: !!this._exec('govulncheck -version 2>&1'), version: null };

    const state = this._loadScanState();
    state.tools = tools;
    this._saveScanState(state);

    return tools;
  },
```

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add SecurityScanner with tool detection"
```

---

### Task 3: Implement Semgrep scanning (scanFiles + runSemgrep)

**Files:**
- Modify: `build/bin/build-tools.cjs` (continue SecurityScanner object)

- [ ] **Step 1: Add Semgrep methods inside SecurityScanner**

Add after the `detectTools()` method, still inside the SecurityScanner object:

```javascript
  // ---- Semgrep ----

  _mapSemgrepSeverity(result) {
    const severity = (result.extra?.severity || '').toUpperCase();
    const impact = (result.extra?.metadata?.impact || '').toUpperCase();

    if (severity === 'ERROR') return 'critical';
    if (severity === 'WARNING' && impact === 'HIGH') return 'high';
    if (severity === 'WARNING') return 'medium';
    return 'low';
  },

  _parseSemgrepOutput(jsonStr, sprintId) {
    try {
      const data = JSON.parse(jsonStr);
      const results = data.results || [];
      return results.map(r => ({
        id: this._genFindingId(),
        tool: 'semgrep',
        rule: r.check_id || 'unknown',
        severity: this._mapSemgrepSeverity(r),
        file: r.path,
        line: r.start?.line || 0,
        message: r.extra?.message || '',
        cwe: r.extra?.metadata?.cwe?.[0] || null,
        owasp: r.extra?.metadata?.owasp?.[0] || null,
        status: 'open',
        found_at: now(),
        sprint_id: sprintId || null,
      }));
    } catch {
      return [];
    }
  },

  runSemgrep(target, rulesets, timeout) {
    const state = this._loadScanState();
    if (!state.tools?.semgrep?.available) {
      return { findings: [], error: 'semgrep not installed', skipped: true };
    }

    const configFlags = rulesets.map(r => `--config ${r}`).join(' ');
    const cmd = `semgrep ${configFlags} --json --quiet ${target}`;
    const result = this._execOrError(cmd, { timeout: timeout || 120000 });

    if (result.error && !result.output) {
      return { findings: [], error: `semgrep failed: ${result.error}`, skipped: false };
    }

    const output = result.output || result.error; // semgrep writes JSON to stdout even on findings
    const sprint = loadState('sprint');
    const sprintId = sprint?.active_sprint?.id || null;
    const findings = this._parseSemgrepOutput(output, sprintId);

    return { findings, error: null, skipped: false };
  },

  scanFiles(files) {
    if (!files || files.length === 0) return { findings: [], summary: { critical: 0, high: 0, medium: 0, low: 0 } };

    const target = files.join(' ');
    const result = this.runSemgrep(target, SEMGREP_RULESETS.quick, 30000);

    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of result.findings) {
      summary[f.severity]++;
    }

    // Apply posture
    const posture = this._getPosture();
    const thresholds = POSTURE_THRESHOLDS[posture] || POSTURE_THRESHOLDS.moderate;
    let blocked = false;
    for (const sev of SEVERITY_LEVELS) {
      if (summary[sev] > 0 && thresholds[sev] === 'block') {
        blocked = true;
        break;
      }
    }

    // Save findings to state — merge with existing, auto-resolve stale findings
    const state = this._loadScanState();
    state.findings = this._mergeFindings(state.findings, result.findings);
    state.last_scan = {
      type: 'files',
      timestamp: now(),
      tools_used: result.skipped ? [] : ['semgrep'],
      tools_errored: result.error ? ['semgrep'] : [],
      summary,
    };
    // Append to history (max 50)
    state.scan_history.push({
      timestamp: now(),
      type: 'files',
      files_scanned: files.length,
      findings_count: result.findings.length,
      tools_used: result.skipped ? [] : ['semgrep'],
    });
    if (state.scan_history.length > 50) {
      state.scan_history = state.scan_history.slice(-50);
    }
    this._saveScanState(state);

    return {
      findings: result.findings,
      summary,
      blocked,
      posture,
      error: result.error,
    };
  },

  // ---- Deduplication ----

  _deduplicateFindings(findings) {
    const seen = new Map();
    const deduped = [];
    for (const f of findings) {
      if (f.cwe) {
        const key = `${f.file}:${f.line}:${f.cwe}`;
        if (seen.has(key)) {
          // Keep SonarQube over Semgrep (richer metadata)
          const existing = seen.get(key);
          if (f.tool === 'sonar_scanner' && existing.tool === 'semgrep') {
            deduped[deduped.indexOf(existing)] = f;
            seen.set(key, f);
          }
          continue;
        }
        seen.set(key, f);
      }
      deduped.push(f);
    }
    return deduped;
  },

  // ---- Merge + Auto-Resolution ----

  _mergeFindings(existing, newFindings) {
    // 1. Preserve dismissed/false_positive findings from existing
    const preserved = existing.filter(f => f.status === 'dismissed' || f.status === 'false_positive');

    // 2. Auto-resolve: existing open findings NOT present in new scan → resolved
    const newKeys = new Set(newFindings.map(f => `${f.file}:${f.line}:${f.rule}`));
    const autoResolved = existing
      .filter(f => f.status === 'open' && !newKeys.has(`${f.file}:${f.line}:${f.rule}`))
      .map(f => ({ ...f, status: 'resolved', resolved_at: now() }));

    // 3. Combine: preserved + auto-resolved + new (deduplicated)
    const combined = [...preserved, ...autoResolved, ...newFindings];
    return this._deduplicateFindings(combined);
  },
```

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add Semgrep scanning with severity mapping, deduplication, and auto-resolution"
```

---

### Task 4: Implement SonarQube scanning

**Files:**
- Modify: `build/bin/build-tools.cjs` (continue SecurityScanner object)

- [ ] **Step 1: Add SonarQube methods**

Add after the deduplication method, still inside SecurityScanner:

```javascript
  // ---- SonarQube ----

  _mapSonarSeverity(severity) {
    const map = { BLOCKER: 'critical', CRITICAL: 'high', MAJOR: 'medium', MINOR: 'low', INFO: 'low' };
    return map[severity] || 'low';
  },

  _pollSonarTask(serverUrl, projectKey, token, maxWaitMs) {
    const maxWait = maxWaitMs || 300000; // 5 minutes
    let interval = 3000;
    const maxInterval = 10000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      const cmd = token
        ? `curl -s -u "${token}:" "${serverUrl}/api/ce/component?component=${projectKey}"`
        : `curl -s "${serverUrl}/api/ce/component?component=${projectKey}"`;
      const result = this._exec(cmd, { timeout: 15000 });
      if (result) {
        try {
          const data = JSON.parse(result);
          const task = data.current;
          if (task && (task.status === 'SUCCESS' || task.status === 'FAILED')) {
            return task.status;
          }
        } catch {}
      }

      // Sleep with linear backoff
      _execSyncRaw(`sleep ${interval / 1000}`);
      elapsed += interval;
      interval = Math.min(interval + 1000, maxInterval);
    }

    return 'TIMEOUT';
  },

  runSonarQube() {
    const state = this._loadScanState();
    if (!state.tools?.sonar_scanner?.available) {
      return { findings: [], error: 'sonar-scanner not installed', skipped: true };
    }

    const config = this._getSonarConfig();
    if (!config.sonarqube_url || !config.sonarqube_project_key) {
      return { findings: [], error: 'SonarQube not configured. Run: scan sonarqube <url> <project-key>', skipped: true };
    }

    const token = process.env[config.sonarqube_token_env || 'SONAR_TOKEN'] || '';
    const tokenFlag = token ? `-Dsonar.token=${token}` : '';

    // 1. Trigger scan
    const scanCmd = `sonar-scanner -Dsonar.projectKey=${config.sonarqube_project_key} -Dsonar.host.url=${config.sonarqube_url} ${tokenFlag}`;
    const scanResult = this._execOrError(scanCmd, { timeout: 300000 });
    if (scanResult.error && !scanResult.output) {
      return { findings: [], error: `sonar-scanner failed: ${scanResult.error}`, skipped: false };
    }

    // 2. Poll for completion
    const taskStatus = this._pollSonarTask(config.sonarqube_url, config.sonarqube_project_key, token);
    if (taskStatus !== 'SUCCESS') {
      return { findings: [], error: `SonarQube analysis ${taskStatus}`, skipped: false };
    }

    // 3. Fetch issues
    const authFlag = token ? `-u "${token}:"` : '';
    const issuesCmd = `curl -s ${authFlag} "${config.sonarqube_url}/api/issues/search?componentKeys=${config.sonarqube_project_key}&severities=BLOCKER,CRITICAL,MAJOR&types=VULNERABILITY,BUG&ps=500"`;
    const issuesResult = this._exec(issuesCmd, { timeout: 30000 });

    if (!issuesResult) {
      return { findings: [], error: 'Failed to fetch SonarQube issues', skipped: false };
    }

    const sprint = loadState('sprint');
    const sprintId = sprint?.active_sprint?.id || null;

    try {
      const data = JSON.parse(issuesResult);
      const findings = (data.issues || []).map(issue => ({
        id: this._genFindingId(),
        tool: 'sonar_scanner',
        rule: issue.rule || 'unknown',
        severity: this._mapSonarSeverity(issue.severity),
        file: (issue.component || '').replace(`${config.sonarqube_project_key}:`, ''),
        line: issue.line || 0,
        message: issue.message || '',
        cwe: issue.tags?.find(t => t.startsWith('cwe-'))?.replace('cwe-', 'CWE-') || null,
        owasp: issue.tags?.find(t => t.startsWith('owasp-')) || null,
        status: 'open',
        found_at: now(),
        sprint_id: sprintId,
      }));
      return { findings, error: null, skipped: false };
    } catch {
      return { findings: [], error: 'Failed to parse SonarQube response', skipped: false };
    }
  },
```

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add SonarQube scanning with polling and issue fetching"
```

---

### Task 5: Implement dependency audit and DAST

**Files:**
- Modify: `build/bin/build-tools.cjs` (continue SecurityScanner object)

- [ ] **Step 1: Add dependency audit method**

```javascript
  // ---- Dependency Audit ----

  runDependencyAudit() {
    const findings = [];
    const toolsUsed = [];
    const toolsErrored = [];
    const sprint = loadState('sprint');
    const sprintId = sprint?.active_sprint?.id || null;
    const projectRoot = process.cwd();

    // npm
    if (fileExists(path.join(projectRoot, 'package-lock.json'))) {
      const result = this._execOrError('npm audit --json 2>/dev/null', { timeout: 60000 });
      if (result.output) {
        toolsUsed.push('npm_audit');
        try {
          const data = JSON.parse(result.output);
          const vulns = data.vulnerabilities || {};
          for (const [name, info] of Object.entries(vulns)) {
            findings.push({
              id: this._genFindingId(),
              tool: 'npm_audit',
              rule: `npm:${name}`,
              severity: info.severity === 'critical' ? 'critical' : info.severity === 'high' ? 'high' : info.severity === 'moderate' ? 'medium' : 'low',
              file: 'package-lock.json',
              line: 0,
              message: `${name}@${info.range || 'unknown'}: ${info.title || info.via?.[0]?.title || 'vulnerability'}`,
              cwe: info.via?.[0]?.cwe?.[0] || null,
              owasp: null,
              status: 'open',
              found_at: now(),
              sprint_id: sprintId,
            });
          }
        } catch { toolsErrored.push('npm_audit'); }
      } else { toolsErrored.push('npm_audit'); }
    }

    // yarn
    if (fileExists(path.join(projectRoot, 'yarn.lock'))) {
      const result = this._execOrError('yarn audit --json 2>/dev/null', { timeout: 60000 });
      if (result.output) {
        toolsUsed.push('yarn_audit');
        // yarn audit outputs newline-delimited JSON
        try {
          const lines = result.output.trim().split('\n');
          for (const line of lines) {
            const entry = JSON.parse(line);
            if (entry.type === 'auditAdvisory') {
              const adv = entry.data?.advisory || {};
              findings.push({
                id: this._genFindingId(),
                tool: 'yarn_audit',
                rule: `yarn:${adv.module_name || 'unknown'}`,
                severity: adv.severity === 'critical' ? 'critical' : adv.severity === 'high' ? 'high' : adv.severity === 'moderate' ? 'medium' : 'low',
                file: 'yarn.lock',
                line: 0,
                message: adv.title || 'vulnerability',
                cwe: adv.cwe || null,
                owasp: null,
                status: 'open',
                found_at: now(),
                sprint_id: sprintId,
              });
            }
          }
        } catch { toolsErrored.push('yarn_audit'); }
      }
    }

    // pnpm
    if (fileExists(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      const result = this._execOrError('pnpm audit --json 2>/dev/null', { timeout: 60000 });
      if (result.output) {
        toolsUsed.push('pnpm_audit');
        try {
          const data = JSON.parse(result.output);
          const advisories = data.advisories || {};
          for (const [, adv] of Object.entries(advisories)) {
            findings.push({
              id: this._genFindingId(),
              tool: 'pnpm_audit',
              rule: `pnpm:${adv.module_name || 'unknown'}`,
              severity: adv.severity === 'critical' ? 'critical' : adv.severity === 'high' ? 'high' : adv.severity === 'moderate' ? 'medium' : 'low',
              file: 'pnpm-lock.yaml',
              line: 0,
              message: adv.title || 'vulnerability',
              cwe: adv.cwe || null,
              owasp: null,
              status: 'open',
              found_at: now(),
              sprint_id: sprintId,
            });
          }
        } catch { toolsErrored.push('pnpm_audit'); }
      }
    }

    // pip-audit
    if (fileExists(path.join(projectRoot, 'requirements.txt')) || fileExists(path.join(projectRoot, 'Pipfile')) || fileExists(path.join(projectRoot, 'pyproject.toml'))) {
      const state = this._loadScanState();
      if (state.tools?.pip_audit?.available) {
        const result = this._execOrError('pip-audit --format json 2>/dev/null', { timeout: 60000 });
        if (result.output) {
          toolsUsed.push('pip_audit');
          try {
            const data = JSON.parse(result.output);
            for (const dep of (data.dependencies || [])) {
              for (const vuln of (dep.vulns || [])) {
                findings.push({
                  id: this._genFindingId(),
                  tool: 'pip_audit',
                  rule: `pip:${vuln.id || 'unknown'}`,
                  severity: 'high', // pip-audit doesn't provide severity; default to high
                  file: 'requirements.txt',
                  line: 0,
                  message: `${dep.name}@${dep.version}: ${vuln.description || vuln.id}`,
                  cwe: null,
                  owasp: null,
                  status: 'open',
                  found_at: now(),
                  sprint_id: sprintId,
                });
              }
            }
          } catch { toolsErrored.push('pip_audit'); }
        }
      }
    }

    // govulncheck
    if (fileExists(path.join(projectRoot, 'go.sum'))) {
      const state = this._loadScanState();
      if (state.tools?.govulncheck?.available) {
        const result = this._execOrError('govulncheck -json ./... 2>/dev/null', { timeout: 60000 });
        if (result.output) {
          toolsUsed.push('govulncheck');
          try {
            const lines = result.output.trim().split('\n');
            for (const line of lines) {
              const entry = JSON.parse(line);
              if (entry.finding) {
                findings.push({
                  id: this._genFindingId(),
                  tool: 'govulncheck',
                  rule: `go:${entry.finding.osv || 'unknown'}`,
                  severity: 'high',
                  file: 'go.sum',
                  line: 0,
                  message: entry.finding.osv || 'Go vulnerability',
                  cwe: null,
                  owasp: null,
                  status: 'open',
                  found_at: now(),
                  sprint_id: sprintId,
                });
              }
            }
          } catch { toolsErrored.push('govulncheck'); }
        }
      }
    }

    return { findings, toolsUsed, toolsErrored };
  },
```

- [ ] **Step 2: Add DAST method**

```javascript
  // ---- DAST (OWASP ZAP) ----

  runZap(targetUrl) {
    const state = this._loadScanState();
    if (!state.tools?.zap?.available) {
      return { findings: [], error: 'ZAP not available (install Docker or zap.sh)', skipped: true };
    }

    const reportPath = path.join(STATE_DIR, 'zap-report.json');
    const method = state.tools.zap.method;
    let result;

    if (method === 'docker') {
      result = this._execOrError(
        `docker run --rm --network host -v ${STATE_DIR}:/zap/wrk ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${targetUrl} -J zap-report.json`,
        { timeout: 600000 }
      );
    } else {
      result = this._execOrError(
        `zap.sh -cmd -quickurl ${targetUrl} -quickout ${reportPath} -quickprogress`,
        { timeout: 600000 }
      );
    }

    // Parse report
    const sprint = loadState('sprint');
    const sprintId = sprint?.active_sprint?.id || null;
    const findings = [];

    if (fileExists(reportPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        const alerts = data.site?.[0]?.alerts || data.alerts || [];
        for (const alert of alerts) {
          const riskMap = { '3': 'critical', '2': 'high', '1': 'medium', '0': 'low' };
          findings.push({
            id: this._genFindingId(),
            tool: 'zap',
            rule: `zap:${alert.pluginid || alert.alertRef || 'unknown'}`,
            severity: riskMap[String(alert.riskcode)] || 'medium',
            file: alert.url || targetUrl,
            line: 0,
            message: alert.name || alert.alert || 'ZAP finding',
            cwe: alert.cweid ? `CWE-${alert.cweid}` : null,
            owasp: null,
            status: 'open',
            found_at: now(),
            sprint_id: sprintId,
          });
        }
      } catch {}
      // Clean up report file
      try { fs.unlinkSync(reportPath); } catch {}
    }

    return { findings, error: result.error, skipped: false };
  },

  // ---- scanRuntime wrapper (persists ZAP findings to state) ----

  scanRuntime(targetUrl) {
    const zapResult = this.runZap(targetUrl);

    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of zapResult.findings) {
      summary[f.severity]++;
    }

    // Apply posture
    const posture = this._getPosture();
    const thresholds = POSTURE_THRESHOLDS[posture] || POSTURE_THRESHOLDS.moderate;
    let blocked = false;
    for (const sev of SEVERITY_LEVELS) {
      if (summary[sev] > 0 && thresholds[sev] === 'block') {
        blocked = true;
        break;
      }
    }

    // Save to state
    const state = this._loadScanState();
    state.findings = this._mergeFindings(state.findings, zapResult.findings);
    state.last_scan = {
      type: 'runtime',
      timestamp: now(),
      tools_used: zapResult.skipped ? [] : ['zap'],
      tools_errored: zapResult.error && !zapResult.skipped ? ['zap'] : [],
      summary,
    };
    state.scan_history.push({
      timestamp: now(),
      type: 'runtime',
      files_scanned: null,
      findings_count: zapResult.findings.length,
      tools_used: zapResult.skipped ? [] : ['zap'],
    });
    if (state.scan_history.length > 50) {
      state.scan_history = state.scan_history.slice(-50);
    }
    this._saveScanState(state);

    return { findings: zapResult.findings, summary, blocked, posture, error: zapResult.error };
  },
```

- [ ] **Step 3: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add dependency audit, DAST scanning, and scanRuntime wrapper"
```

---

### Task 6: Implement scanProject, applyPosture, getReport, dismiss, configure

**Files:**
- Modify: `build/bin/build-tools.cjs` (continue SecurityScanner object)

- [ ] **Step 1: Add scanProject**

```javascript
  // ---- Full Project Scan ----

  scanProject(opts) {
    opts = opts || {};
    const toolsUsed = [];
    const toolsErrored = [];
    let allFindings = [];

    // 1. Semgrep full project (skip if --sonar-only)
    if (!opts.sonarOnly) {
      const semgrepResult = this.runSemgrep('.', SEMGREP_RULESETS.full, 120000);
      if (!semgrepResult.skipped) toolsUsed.push('semgrep');
      if (semgrepResult.error && !semgrepResult.skipped) toolsErrored.push('semgrep');
      allFindings = allFindings.concat(semgrepResult.findings);
    }

    // 2. SonarQube (skip if --semgrep-only)
    if (!opts.semgrepOnly) {
      const sonarResult = this.runSonarQube();
      if (!sonarResult.skipped) toolsUsed.push('sonar_scanner');
      if (sonarResult.error && !sonarResult.skipped) toolsErrored.push('sonar_scanner');
      allFindings = allFindings.concat(sonarResult.findings);
    }

    // 3. Dependency audit (skip if --sonar-only or --semgrep-only)
    if (!opts.sonarOnly && !opts.semgrepOnly) {
      const depResult = this.runDependencyAudit();
      toolsUsed.push(...depResult.toolsUsed);
      toolsErrored.push(...depResult.toolsErrored);
      allFindings = allFindings.concat(depResult.findings);
    }

    // Deduplicate
    allFindings = this._deduplicateFindings(allFindings);

    // Summary
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of allFindings) {
      if (f.status === 'open') summary[f.severity]++;
    }

    // Apply posture
    const posture = this._getPosture();
    const thresholds = POSTURE_THRESHOLDS[posture] || POSTURE_THRESHOLDS.moderate;
    let blocked = false;
    for (const sev of SEVERITY_LEVELS) {
      if (summary[sev] > 0 && thresholds[sev] === 'block') {
        blocked = true;
        break;
      }
    }

    // Save state — merge with existing, preserving dismissed/resolved findings
    const state = this._loadScanState();
    state.findings = this._mergeFindings(state.findings, allFindings);
    state.last_scan = {
      type: 'project',
      timestamp: now(),
      tools_used: toolsUsed,
      tools_errored: toolsErrored,
      summary,
    };
    state.scan_history.push({
      timestamp: now(),
      type: 'project',
      files_scanned: null,
      findings_count: allFindings.length,
      tools_used: toolsUsed,
    });
    if (state.scan_history.length > 50) {
      state.scan_history = state.scan_history.slice(-50);
    }
    this._saveScanState(state);

    return { findings: allFindings, summary, blocked, posture, toolsUsed, toolsErrored };
  },
```

- [ ] **Step 2: Add getReport**

```javascript
  // ---- Reporting ----

  getReport() {
    const state = this._loadScanState();
    if (!state.last_scan) return 'No scans have been run yet. Run: scan detect, then scan project';

    const s = state.last_scan;
    const posture = this._getPosture();
    const openFindings = state.findings.filter(f => f.status === 'open');

    const lines = [
      'Security Scan Report',
      `  Posture: ${posture}`,
      `  Last scan: ${s.type} at ${s.timestamp}`,
      `  Tools used: ${s.tools_used.join(', ') || 'none'}`,
    ];

    if (s.tools_errored?.length > 0) {
      lines.push(`  Tools errored: ${s.tools_errored.join(', ')}`);
    }

    lines.push('');
    lines.push(`  Findings (open): ${openFindings.length}`);
    lines.push(`    Critical: ${s.summary.critical}`);
    lines.push(`    High: ${s.summary.high}`);
    lines.push(`    Medium: ${s.summary.medium}`);
    lines.push(`    Low: ${s.summary.low}`);

    if (openFindings.length > 0) {
      lines.push('');
      lines.push('  Top findings:');
      const top = openFindings
        .sort((a, b) => SEVERITY_LEVELS.indexOf(a.severity) - SEVERITY_LEVELS.indexOf(b.severity))
        .slice(0, 10);
      for (const f of top) {
        lines.push(`    [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.message} (${f.tool})`);
      }
      if (openFindings.length > 10) {
        lines.push(`    ... and ${openFindings.length - 10} more`);
      }
    }

    return lines.join('\n');
  },
```

- [ ] **Step 3: Add dismiss and configure methods**

```javascript
  // ---- Finding Management ----

  dismiss(findingId, reason, isFalsePositive) {
    const state = this._loadScanState();
    const finding = state.findings.find(f => f.id === findingId);
    if (!finding) return { error: `Finding ${findingId} not found` };

    finding.status = isFalsePositive ? 'false_positive' : 'dismissed';
    finding.dismissed_reason = reason;
    finding.dismissed_at = now();
    this._saveScanState(state);

    return { success: true, finding };
  },

  // ---- Configuration ----

  configure(posture) {
    if (!POSTURE_THRESHOLDS[posture]) {
      return { error: `Invalid posture: ${posture}. Use: strict, moderate, permissive` };
    }
    const project = loadState('project') || {};
    if (!project.security) project.security = {};
    project.security.posture = posture;
    saveState('project', project);
    return { success: true, posture };
  },

  configureSonarQube(serverUrl, projectKey) {
    const project = loadState('project') || {};
    if (!project.security) project.security = {};
    project.security.sonarqube_url = serverUrl;
    project.security.sonarqube_project_key = projectKey;
    project.security.sonarqube_token_env = project.security.sonarqube_token_env || 'SONAR_TOKEN';
    saveState('project', project);
    return { success: true, serverUrl, projectKey };
  },
};
```

Note: this closing `};` closes the entire SecurityScanner object.

- [ ] **Step 4: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add scanProject, report, dismiss, and configure methods"
```

---

## Chunk 2: CLI Subcommands

### Task 7: Add scan CLI subcommands to Commands object

**Files:**
- Modify: `build/bin/build-tools.cjs` (Commands object — search for `const Commands = {`, add after `merge` command)

- [ ] **Step 1: Add scan command handler**

```javascript
  scan(args) {
    const sub = args[0];
    const validSubs = ['detect', 'files', 'project', 'runtime', 'report', 'configure', 'sonarqube', 'history', 'dismiss'];
    if (!sub || !validSubs.includes(sub)) {
      console.error('Usage: scan <detect|files|project|runtime|report|configure|sonarqube|history|dismiss>');
      process.exit(1);
    }

    if (sub === 'detect') {
      const tools = SecurityScanner.detectTools();
      for (const [name, info] of Object.entries(tools)) {
        const status = info.available ? '✓' : '✗';
        const version = info.version ? ` ${info.version}` : '';
        const method = info.method ? ` (${info.method})` : '';
        console.log(`  ${status} ${name}${version}${method}`);
      }
    } else if (sub === 'files') {
      const files = args.slice(1);
      if (files.length === 0) {
        console.error('Usage: scan files <file1> [file2...]');
        process.exit(1);
      }
      const result = SecurityScanner.scanFiles(files);
      console.log(JSON.stringify(result, null, 2));
      if (result.blocked) process.exit(1);
    } else if (sub === 'project') {
      const sonarOnly = args.includes('--sonar-only');
      const semgrepOnly = args.includes('--semgrep-only');
      if (sonarOnly) {
        console.log('Running SonarQube scan only...');
      } else if (semgrepOnly) {
        console.log('Running Semgrep scan only...');
      } else {
        console.log('Running full project scan...');
      }
      const result = SecurityScanner.scanProject({ sonarOnly, semgrepOnly });
      console.log(JSON.stringify({
        summary: result.summary,
        blocked: result.blocked,
        posture: result.posture,
        tools_used: result.toolsUsed,
        tools_errored: result.toolsErrored,
        findings_count: result.findings.length,
      }, null, 2));
      if (result.blocked) process.exit(1);
    } else if (sub === 'runtime') {
      const url = args[1];
      if (!url) {
        console.error('Usage: scan runtime <target-url>');
        process.exit(1);
      }
      console.log(`Running DAST scan against ${url}...`);
      const result = SecurityScanner.scanRuntime(url);
      console.log(JSON.stringify({
        summary: result.summary,
        blocked: result.blocked,
        posture: result.posture,
        findings_count: result.findings.length,
      }, null, 2));
      if (result.blocked) process.exit(1);
    } else if (sub === 'report') {
      console.log(SecurityScanner.getReport());
    } else if (sub === 'configure') {
      const posture = args[1];
      if (!posture) {
        console.error('Usage: scan configure <strict|moderate|permissive>');
        process.exit(1);
      }
      const result = SecurityScanner.configure(posture);
      if (result.error) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`Security posture set to: ${posture}`);
    } else if (sub === 'sonarqube') {
      const url = args[1];
      const projectKey = args[2];
      if (!url || !projectKey) {
        console.error('Usage: scan sonarqube <server-url> <project-key>');
        process.exit(1);
      }
      const result = SecurityScanner.configureSonarQube(url, projectKey);
      console.log(`SonarQube configured: ${url} / ${projectKey}`);
      console.log(`Token will be read from env var: ${result.sonarqube_token_env || 'SONAR_TOKEN'}`);
    } else if (sub === 'history') {
      const state = SecurityScanner._loadScanState();
      console.log(JSON.stringify(state.scan_history, null, 2));
    } else if (sub === 'dismiss') {
      const findingId = args[1];
      const isFP = args.includes('--false-positive');
      const reasonParts = args.slice(2).filter(a => a !== '--false-positive');
      const reason = reasonParts.join(' ');
      if (!findingId || !reason) {
        console.error('Usage: scan dismiss <finding-id> [--false-positive] <reason>');
        process.exit(1);
      }
      const result = SecurityScanner.dismiss(findingId, reason, isFP);
      if (result.error) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(`Finding ${findingId} ${isFP ? 'marked as false positive' : 'dismissed'}: ${reason}`);
    }
  },
```

- [ ] **Step 2: Add help text in main()**

Search for `console.log('Commands:')` and add after the `merge` help line:

```javascript
    console.log('  scan <detect|files|project|runtime|report|configure|sonarqube|history|dismiss>  Security scanning');
```

- [ ] **Step 3: Test detect**

```bash
node build/bin/build-tools.cjs scan detect
```

Expected: Shows available tools with ✓/✗ status.

- [ ] **Step 4: Test configure**

```bash
node build/bin/build-tools.cjs scan configure moderate
```

Expected: `Security posture set to: moderate`

- [ ] **Step 5: Test report (no prior scans)**

```bash
node build/bin/build-tools.cjs scan report
```

Expected: `No scans have been run yet.`

- [ ] **Step 6: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(security): add scan CLI subcommands"
```

---

## Chunk 3: Markdown Files (Commands, Context, Agent)

### Task 8: Create build-scan.md command + slash command

**Files:**
- Create: `build/commands/build-scan.md`
- Create: `.claude/commands/build-scan.md`

- [ ] **Step 1: Create build/commands/build-scan.md**

```markdown
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
   - `--sonar-only`: run only SonarQube scan via `build-tools.cjs scan project` (skip semgrep)
   - `--semgrep-only`: run only Semgrep via `build-tools.cjs scan files .`

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
```

- [ ] **Step 2: Copy to .claude/commands/**

```bash
cp build/commands/build-scan.md .claude/commands/build-scan.md
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-scan.md .claude/commands/build-scan.md
git commit -m "feat(security): add /build-scan command"
```

---

### Task 9: Update build-init.md with security posture

**Files:**
- Modify: `build/commands/build-init.md`

- [ ] **Step 1: Read current file**

Read `build/commands/build-init.md` to find the initialization steps section.

- [ ] **Step 2: Add security configuration step**

After the project name/description step, add:

```markdown
### Security Configuration

After initializing the project brain, configure security scanning:

1. **Set security posture** — ask the user:
   ```
   Security Posture:
     What security enforcement level for this project?

     1. strict     — HIGH/CRITICAL block tasks, MEDIUM warns
     2. moderate   — HIGH/CRITICAL warn, rest logged (default)
     3. permissive — everything logged, nothing blocks
   ```
   Call `build-tools.cjs scan configure <posture>` with the user's choice (default: moderate).

2. **SonarQube setup** (optional) — ask:
   ```
   SonarQube server URL? (press Enter to skip)
   SonarQube project key? (press Enter to skip)
   ```
   If provided, call `build-tools.cjs scan sonarqube <url> <key>`.

3. **Detect tools** — call `build-tools.cjs scan detect` and show results.
   Suggest installing missing tools if needed.
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-init.md
git commit -m "feat(security): add security posture config to build-init"
```

---

### Task 10: Update build-execute.md with security scan step

**Files:**
- Modify: `build/commands/build-execute.md`

- [ ] **Step 1: Read current file and find self-validation section**

Search for "Self-validate" or step 5 in the execute command.

- [ ] **Step 2: Add security scan step**

Add after the self-validate step, before generating execution report:

```markdown
### Security Scan (inline, per-task)

After self-validation and before marking the task complete:

1. Collect files modified during this task
2. Call `build-tools.cjs scan files <file1> <file2> ...`
3. Check the result:
   - If `blocked: true` → set task status to `blocked_by_security`, report findings, stop
   - If findings exist but not blocked → report findings as warnings, continue
   - If no findings → continue silently
4. Include any findings in the execution report

This adds ~1-2 seconds per task. Only runs Semgrep (quick rulesets), not SonarQube.
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-execute.md
git commit -m "feat(security): add per-task security scan to build-execute"
```

---

### Task 11: Update build-review.md with scan integration

**Files:**
- Modify: `build/commands/build-review.md`

- [ ] **Step 1: Read current file**

Read `build/commands/build-review.md` to find the security-reviewer agent dispatch section.

- [ ] **Step 2: Add scan integration before security reviewer dispatch**

Add before the security-reviewer agent is dispatched:

```markdown
### Automated Security Scan

Before dispatching the security-reviewer agent:

1. Run `build-tools.cjs scan project` — full SAST + dependency audit
2. Read scan results from `build-tools.cjs scan report`
3. Include findings in the security-reviewer agent's context pack:

```
## Scan Findings
The following vulnerabilities were detected by automated scanning tools:

{findings from scan report, formatted as table}

Cross-reference these findings with your manual code review. Flag any that the
scanners missed. Assess whether scanner findings are true positives or false positives.
```

The security-reviewer now has structured scan data alongside the code. It should:
- Confirm or dispute each automated finding
- Identify vulnerabilities the scanners missed
- Recommend specific fixes for confirmed findings
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-review.md
git commit -m "feat(security): add scan integration to build-review"
```

---

### Task 12: Update build-verify.md with DAST flag

**Files:**
- Modify: `build/commands/build-verify.md`

- [ ] **Step 1: Read current file**

Read `build/commands/build-verify.md`.

- [ ] **Step 2: Add DAST section**

Add:

```markdown
### DAST Scanning (optional)

When `/build-verify --dast <url>` is provided:

1. Verify ZAP is available: `build-tools.cjs scan detect`
2. Run DAST: `build-tools.cjs scan runtime <url>`
3. Include DAST findings in the verification report
4. If posture=strict and HIGH/CRITICAL DAST findings → verification fails

This is opt-in. Most sprints skip DAST. Only use when the sprint produces a running service.
```

- [ ] **Step 3: Commit**

```bash
git add build/commands/build-verify.md
git commit -m "feat(security): add DAST flag to build-verify"
```

---

### Task 13: Update security-reviewer agent and review pack

**Files:**
- Modify: `build/governance/agents/security-reviewer.md`
- Modify: `build/context/templates/review-pack.md`

- [ ] **Step 1: Read security-reviewer.md**

Read `build/governance/agents/security-reviewer.md`.

- [ ] **Step 2: Add scan findings section to security-reviewer.md**

Append:

```markdown

---

## Scan Findings Integration

When automated security scan results are available (from `/build-review` or `/build-scan`), the security reviewer receives structured findings alongside the code.

### How to Use Scan Data

1. **Cross-reference**: Compare automated findings against your manual code review. Automated tools catch pattern-based vulnerabilities but miss logic flaws.
2. **Validate**: Assess whether each automated finding is a true positive or false positive. Report your assessment.
3. **Supplement**: Identify vulnerabilities the scanners missed — business logic flaws, authorization bypasses, race conditions, and other issues that require understanding intent.
4. **Prioritize**: Focus manual review on areas the scanners flagged — these are higher-risk code paths.

### Scan Data Format

```
[SEVERITY] file:line — message (tool)
```

Tools: `semgrep` (SAST), `sonar_scanner` (SAST), `npm_audit`/`yarn_audit`/`pnpm_audit` (dependency), `pip_audit` (dependency), `govulncheck` (dependency), `zap` (DAST).
```

- [ ] **Step 3: Update review-pack.md**

Read `build/context/templates/review-pack.md` and append:

```markdown

### Scan Findings (Parallel Mode Addition)

When scan results are available, include a summary in the review context:

| Source | Budget |
|--------|--------|
| Scan findings summary | 500 tokens |

Load via `build-tools.cjs scan report`. Include the top 10 findings by severity. If findings exceed 500 tokens, include only CRITICAL and HIGH severity.
```

- [ ] **Step 4: Commit**

```bash
git add build/governance/agents/security-reviewer.md build/context/templates/review-pack.md
git commit -m "feat(security): add scan findings integration to security reviewer and review pack"
```

---

## Summary

| Task | Component | Lines Added (est.) |
|------|-----------|-------------------|
| 1 | STATE_FILES + constants | ~20 |
| 2 | SecurityScanner core + detectTools | ~80 |
| 3 | Semgrep scanning + dedup | ~120 |
| 4 | SonarQube scanning | ~90 |
| 5 | Dependency audit + DAST | ~180 |
| 6 | scanProject + report + dismiss + configure | ~130 |
| 7 | scan CLI subcommands | ~80 |
| 8 | build-scan.md command | ~60 |
| 9 | build-init.md security config | ~25 |
| 10 | build-execute.md scan step | ~20 |
| 11 | build-review.md scan integration | ~25 |
| 12 | build-verify.md DAST flag | ~15 |
| 13 | security-reviewer.md + review-pack.md | ~40 |
| **Total** | | **~885 lines** |

13 tasks, 13 commits. Chunk 1 (Tasks 1-6) is the CJS core. Chunk 2 (Task 7) is CLI wiring. Chunk 3 (Tasks 8-13) is markdown.
