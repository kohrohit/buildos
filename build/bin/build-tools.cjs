#!/usr/bin/env node
// BuildOS CLI Tool — build-tools.cjs
// State management, context assembly, and workflow orchestration
// Used by hooks.json and slash commands to manage BuildOS lifecycle

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, 'state');
const GOV_DIR = path.join(ROOT, 'governance');
const CONTEXT_DIR = path.join(ROOT, 'context');
const WAVES_DIR = path.join(STATE_DIR, 'waves');

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

const GOVERNANCE_FILES = [
  'core-policies.md',
  'coding-rules.md',
  'architecture-principles.md',
];

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date().toISOString();
}

function genId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}`;
}

function loadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    console.error(`Error reading ${filePath}: ${err.message}`);
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function stateFile(key) {
  return path.join(STATE_DIR, STATE_FILES[key]);
}

function loadState(key) {
  return loadJSON(stateFile(key));
}

function saveState(key, data) {
  saveJSON(stateFile(key), data);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token accounting — enforce budgets, prevent overages
// ---------------------------------------------------------------------------

const TokenCounter = {
  // Conservative estimate: ~4 chars per token (errs on the side of caution)
  estimate(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  },

  /**
   * Assemble content within a token budget. Items must be sorted by priority
   * (highest first). Returns { loaded, dropped, tokensUsed, budget }.
   */
  assembleWithBudget(items, budget) {
    let used = 0;
    const loaded = [];
    const dropped = [];

    for (const item of items) {
      const tokens = this.estimate(item.content);
      if (used + tokens <= budget) {
        loaded.push({ ...item, tokens });
        used += tokens;
      } else {
        dropped.push({ name: item.name, tokens, reason: 'budget_exceeded' });
      }
    }

    return { loaded, dropped, tokensUsed: used, budget };
  },

  /**
   * Log a budget report for debugging and transparency.
   */
  report(packName, result) {
    let msg = `Context Budget: ${packName}\n`;
    msg += `  Used: ${result.tokensUsed}/${result.budget} tokens (${Math.round((result.tokensUsed / result.budget) * 100)}%)\n`;
    if (result.dropped.length > 0) {
      msg += `  Dropped (${result.dropped.length}):\n`;
      for (const d of result.dropped) {
        msg += `    - ${d.name} (~${d.tokens} tokens): ${d.reason}\n`;
      }
    }
    return msg;
  },
};

// ---------------------------------------------------------------------------
// Session-level context cache — load once, reuse across commands
// ---------------------------------------------------------------------------

const CACHE_FILE = path.join(STATE_DIR, '.session-cache.json');

const ContextCache = {
  _cache: null,

  /**
   * Load cache from disk (persists within a session via file).
   */
  _load() {
    if (this._cache) return this._cache;
    this._cache = loadJSON(CACHE_FILE) || {
      governance_version: null,
      governance_rules: null,
      coding_rules: {},       // keyed by language
      sprint_id: null,        // cache invalidates on sprint change
      cached_at: null,
    };
    return this._cache;
  },

  _save() {
    if (this._cache) saveJSON(CACHE_FILE, this._cache);
  },

  /**
   * Get cached governance rules, or null if stale.
   * Cache is valid if governance version hasn't changed.
   */
  getGovernance() {
    const cache = this._load();
    const currentVersion = Governance.computeVersion();
    if (cache.governance_version === currentVersion && cache.governance_rules) {
      return cache.governance_rules;
    }
    return null; // stale, caller should reload
  },

  /**
   * Cache governance rules after loading.
   */
  setGovernance(rules) {
    const cache = this._load();
    cache.governance_version = Governance.computeVersion();
    cache.governance_rules = rules;
    cache.cached_at = now();
    this._save();
  },

  /**
   * Get cached coding rules for a language, or null if not cached.
   */
  getCodingRules(language) {
    const cache = this._load();
    return cache.coding_rules[language] || null;
  },

  /**
   * Cache coding rules for a language.
   */
  setCodingRules(language, content) {
    const cache = this._load();
    cache.coding_rules[language] = { content, cached_at: now() };
    this._save();
  },

  /**
   * Check if cache is for current sprint. If sprint changed, invalidate.
   */
  isSprintCurrent(sprintId) {
    const cache = this._load();
    if (cache.sprint_id !== sprintId) {
      // Sprint changed — invalidate sprint-specific caches
      cache.sprint_id = sprintId;
      cache.coding_rules = {};
      this._save();
      return false;
    }
    return true;
  },

  /**
   * Clear all caches (called at session end or sprint completion).
   */
  clear() {
    this._cache = null;
    try { fs.unlinkSync(CACHE_FILE); } catch { /* ignore */ }
  },
};

// ---------------------------------------------------------------------------
// 1. State Management — CRUD for all state files
// ---------------------------------------------------------------------------

const StateManager = {
  loadAll() {
    const state = {};
    for (const key of Object.keys(STATE_FILES)) {
      state[key] = loadState(key);
    }
    return state;
  },

  isInitialized() {
    const project = loadState('project');
    return project && project.initialized_at !== null;
  },

  resetAll() {
    saveState('project', {
      name: null, description: null, initialized_at: null,
      governance_version: null, brain_files: GOVERNANCE_FILES.map(f => `governance/${f}`),
      active_sprint: null, total_sprints_completed: 0,
      last_review: null, last_learn: null,
    });
    saveState('roadmap', {
      version: '1.0.0', epics: [], current_phase: null,
      created_at: null, updated_at: null,
    });
    saveState('sprint', {
      sprint_id: null, goal: null, status: null,
      started_at: null, completed_at: null,
      in_scope: [], out_of_scope: [], deliverables: [],
      acceptance_criteria: [], tasks: [], blockers: [],
    });
    saveState('task', { tasks: [] });
    saveState('context', {
      last_context_pack: null, loaded_governance: [],
      loaded_rules: [], active_summaries: [],
      compression_log: [], freshness_check_at: null,
    });
    saveState('patterns', { patterns: [], last_updated: null });
    saveState('staging', { patterns: [], last_updated: null });
  },
};

// ---------------------------------------------------------------------------
// 2. Governance helpers
// ---------------------------------------------------------------------------

const Governance = {
  checkBrainFiles() {
    const missing = [];
    for (const f of GOVERNANCE_FILES) {
      if (!fileExists(path.join(GOV_DIR, f))) missing.push(f);
    }
    return { ok: missing.length === 0, missing };
  },

  computeVersion() {
    // Simple hash: concatenate mtimes of governance files
    let hash = '';
    for (const f of GOVERNANCE_FILES) {
      const fp = path.join(GOV_DIR, f);
      try {
        const stat = fs.statSync(fp);
        hash += stat.mtimeMs.toString(36);
      } catch {
        hash += '0';
      }
    }
    return 'gov-' + hash.slice(0, 12);
  },

  loadRules() {
    // Check session cache first
    const cached = ContextCache.getGovernance();
    if (cached) return cached;

    const rules = [];
    for (const f of GOVERNANCE_FILES) {
      const content = readTextFile(path.join(GOV_DIR, f));
      if (content) rules.push({ file: f, loaded: true, size: content.length });
      else rules.push({ file: f, loaded: false, size: 0 });
    }

    // Cache for reuse within session
    ContextCache.setGovernance(rules);
    return rules;
  },
};

// ---------------------------------------------------------------------------
// 3. Context pack assembly
// ---------------------------------------------------------------------------

// Token budgets per context pack (target / hard ceiling)
const PACK_BUDGETS = {
  planning:  { target: 5500, ceiling: 7000 },
  execution: { target: 4300, ceiling: 5500 },
  review:    { target: 4500, ceiling: 6000 },  // blind review (reduced from 7500)
  sprint:    { target: 6000, ceiling: 7500 },
};

const ContextPack = {
  assemble(packName) {
    const budget = PACK_BUDGETS[packName] || { target: 5000, ceiling: 6500 };
    const pack = { name: packName, files: [], governance: [], timestamp: now(), budget: null };

    // Load governance (cached within session)
    const rules = Governance.loadRules();
    pack.governance = rules.filter(r => r.loaded).map(r => r.file);

    // Build priority-ordered items for budget enforcement
    const items = [];

    // Governance files — highest priority
    for (const f of GOVERNANCE_FILES) {
      const content = readTextFile(path.join(GOV_DIR, f));
      if (content) {
        items.push({ name: `governance/${f}`, content, priority: 1 });
      }
    }

    // Pack-specific context file
    const contextFile = path.join(CONTEXT_DIR, `${packName}-context.md`);
    if (fileExists(contextFile)) {
      const content = readTextFile(contextFile);
      if (content) {
        items.push({ name: `context/${packName}`, content, priority: 2 });
        pack.files.push(contextFile);
      }
    }

    // Enforce token budget
    const result = TokenCounter.assembleWithBudget(items, budget.ceiling);
    pack.budget = {
      target: budget.target,
      ceiling: budget.ceiling,
      used: result.tokensUsed,
      dropped: result.dropped,
    };

    // Log budget report if anything was dropped
    if (result.dropped.length > 0) {
      console.error(TokenCounter.report(packName, result));
    }

    // Update context state
    const ctx = loadState('context') || {};
    ctx.last_context_pack = packName;
    ctx.loaded_governance = pack.governance;
    ctx.loaded_rules = rules.map(r => r.file);
    ctx.freshness_check_at = now();
    ctx.last_budget_report = pack.budget;
    saveState('context', ctx);

    return pack;
  },

  getActiveContext() {
    const ctx = loadState('context');
    if (!ctx) return null;
    return {
      pack: ctx.last_context_pack,
      governance: ctx.loaded_governance,
      summaries: ctx.active_summaries ? ctx.active_summaries.length : 0,
      fresh: ctx.freshness_check_at,
      budget: ctx.last_budget_report || null,
    };
  },
};

// ---------------------------------------------------------------------------
// 4. Sprint lifecycle management
// ---------------------------------------------------------------------------

const SprintManager = {
  isActive() {
    const sprint = loadState('sprint');
    return sprint && sprint.status === 'active';
  },

  getActive() {
    const sprint = loadState('sprint');
    if (!sprint || sprint.status !== 'active') return null;
    return sprint;
  },

  create(epicId, goal, inScope, outOfScope, deliverables, criteria) {
    const id = genId('sprint');
    const sprint = {
      sprint_id: id,
      goal,
      status: 'active',
      started_at: now(),
      completed_at: null,
      in_scope: inScope || [],
      out_of_scope: outOfScope || [],
      deliverables: deliverables || [],
      acceptance_criteria: criteria || [],
      tasks: [],
      blockers: [],
    };
    saveState('sprint', sprint);

    // Update project
    const project = loadState('project');
    if (project) {
      project.active_sprint = id;
      saveState('project', project);
    }

    // Update roadmap epic status
    const roadmap = loadState('roadmap');
    if (roadmap && roadmap.epics) {
      const epic = roadmap.epics.find(e => e.id === epicId);
      if (epic) {
        epic.status = 'in-progress';
        roadmap.updated_at = now();
        saveState('roadmap', roadmap);
      }
    }

    return sprint;
  },

  complete() {
    const sprint = loadState('sprint');
    if (!sprint || sprint.status !== 'active') {
      return { error: 'No active sprint to complete' };
    }
    sprint.status = 'completed';
    sprint.completed_at = now();
    saveState('sprint', sprint);

    // Update project
    const project = loadState('project');
    if (project) {
      project.active_sprint = null;
      project.total_sprints_completed = (project.total_sprints_completed || 0) + 1;
      project.last_learn = now();
      saveState('project', project);
    }

    return sprint;
  },

  addBlocker(description) {
    const sprint = loadState('sprint');
    if (!sprint || sprint.status !== 'active') return null;
    sprint.blockers.push({
      id: genId('block'),
      description,
      created_at: now(),
      resolved: false,
    });
    saveState('sprint', sprint);
    return sprint;
  },

  resolveBlocker(blockerId) {
    const sprint = loadState('sprint');
    if (!sprint) return null;
    const blocker = sprint.blockers.find(b => b.id === blockerId);
    if (blocker) {
      blocker.resolved = true;
      blocker.resolved_at = now();
      saveState('sprint', sprint);
    }
    return sprint;
  },
};

// ---------------------------------------------------------------------------
// 5. Task management
// ---------------------------------------------------------------------------

const TaskManager = {
  addTask(title, type, sprintId) {
    const tasks = loadState('task') || { tasks: [] };
    const task = {
      id: genId('task'),
      title,
      sprint_id: sprintId,
      type: type || 'implement',
      status: 'pending',
      assigned_agent: null,
      files_modified: [],
      started_at: null,
      completed_at: null,
      verification_status: null,
    };
    tasks.tasks.push(task);
    saveState('task', tasks);

    // Also add to sprint task list
    const sprint = loadState('sprint');
    if (sprint && sprint.sprint_id === sprintId) {
      sprint.tasks.push(task.id);
      saveState('sprint', sprint);
    }

    return task;
  },

  getNextPending(sprintId) {
    const tasks = loadState('task');
    if (!tasks) return null;
    return tasks.tasks.find(
      t => t.sprint_id === sprintId && t.status === 'pending'
    ) || null;
  },

  startTask(taskId) {
    const tasks = loadState('task');
    if (!tasks) return null;
    const task = tasks.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'in-progress';
      task.started_at = now();
      saveState('task', tasks);
    }
    return task;
  },

  completeTask(taskId, filesModified) {
    const tasks = loadState('task');
    if (!tasks) return null;
    const task = tasks.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completed_at = now();
      task.files_modified = filesModified || [];
      saveState('task', tasks);
    }
    return task;
  },

  setVerification(taskId, status) {
    const tasks = loadState('task');
    if (!tasks) return null;
    const task = tasks.tasks.find(t => t.id === taskId);
    if (task) {
      task.verification_status = status;
      saveState('task', tasks);
    }
    return task;
  },

  getSprintTasks(sprintId) {
    const tasks = loadState('task');
    if (!tasks) return [];
    return tasks.tasks.filter(t => t.sprint_id === sprintId);
  },

  getStats(sprintId) {
    const sprintTasks = this.getSprintTasks(sprintId);
    return {
      total: sprintTasks.length,
      pending: sprintTasks.filter(t => t.status === 'pending').length,
      inProgress: sprintTasks.filter(t => t.status === 'in-progress').length,
      completed: sprintTasks.filter(t => t.status === 'completed').length,
      blocked: sprintTasks.filter(t => t.status === 'blocked').length,
    };
  },
};

// ---------------------------------------------------------------------------
// 6. Roadmap management
// ---------------------------------------------------------------------------

const RoadmapManager = {
  addEpic(title, modules, dependencies, priority, sprintEstimate) {
    const roadmap = loadState('roadmap') || {
      version: '1.0.0', epics: [], current_phase: null,
      created_at: now(), updated_at: now(),
    };
    const epic = {
      id: genId('epic'),
      title,
      status: 'pending',
      modules: modules || [],
      dependencies: dependencies || [],
      sprint_estimate: sprintEstimate || 1,
      priority: priority || 'medium',
    };
    roadmap.epics.push(epic);
    roadmap.updated_at = now();
    if (!roadmap.created_at) roadmap.created_at = now();
    saveState('roadmap', roadmap);
    return epic;
  },

  setPhase(phase) {
    const roadmap = loadState('roadmap');
    if (!roadmap) return null;
    roadmap.current_phase = phase;
    roadmap.updated_at = now();
    saveState('roadmap', roadmap);
    return roadmap;
  },

  updateEpicStatus(epicId, status) {
    const roadmap = loadState('roadmap');
    if (!roadmap) return null;
    const epic = roadmap.epics.find(e => e.id === epicId);
    if (epic) {
      epic.status = status;
      roadmap.updated_at = now();
      saveState('roadmap', roadmap);
    }
    return epic;
  },

  getStats() {
    const roadmap = loadState('roadmap');
    if (!roadmap || !roadmap.epics) return { total: 0, completed: 0, inProgress: 0, pending: 0 };
    return {
      total: roadmap.epics.length,
      completed: roadmap.epics.filter(e => e.status === 'completed').length,
      inProgress: roadmap.epics.filter(e => e.status === 'in-progress').length,
      pending: roadmap.epics.filter(e => e.status === 'pending').length,
      phase: roadmap.current_phase,
    };
  },
};

// ---------------------------------------------------------------------------
// 7. Pattern learning / recording
// ---------------------------------------------------------------------------

const PatternManager = {
  addPattern(opts) {
    const patterns = loadState('patterns') || { patterns: [], last_updated: null };

    // Enforce 50-pattern cap
    const activeCount = patterns.patterns.filter(p => p.status === 'active').length;
    if (activeCount >= 50) {
      return { error: 'At 50-pattern limit. Run /build-audit to prune.' };
    }

    const source = opts.source || 'sprint_review';
    const trustMap = { explicit: 'high', sprint_review: 'medium', log_analysis: 'low' };
    const ttlMap = { explicit: 0, sprint_review: 90, log_analysis: 30 };
    const confMap = { explicit: 0.9, sprint_review: 0.7, log_analysis: 0.5 };

    const trust = opts.trust || trustMap[source] || 'medium';
    const ttlDays = opts.ttl_days != null ? opts.ttl_days : (ttlMap[source] || 90);
    const confidence = opts.confidence != null ? opts.confidence : (confMap[source] || 0.7);

    const pattern = {
      id: genId('pat'),
      category: opts.category || 'general',
      description: opts.description || '',
      why: opts.why || null,
      source: source,
      trust: trust,
      confidence: confidence,
      times_applied: 0,
      ttl_days: ttlDays,
      expires_at: ttlDays === 0 ? null : new Date(Date.now() + ttlDays * 86400000).toISOString(),
      created_at: now(),
      last_reinforced_at: null,
      source_reference: opts.source_reference || null,
      status: 'active',
    };
    patterns.patterns.push(pattern);
    patterns.last_updated = now();
    saveState('patterns', patterns);
    return pattern;
  },

  reinforcePattern(patternId) {
    const patterns = loadState('patterns');
    if (!patterns) return null;
    const pat = patterns.patterns.find(p => p.id === patternId);
    if (pat) {
      pat.times_applied += 1;
      pat.confidence = Math.min(1.0, pat.confidence + 0.05);
      pat.last_reinforced_at = now();
      if (pat.ttl_days && pat.ttl_days > 0) {
        pat.expires_at = new Date(Date.now() + pat.ttl_days * 86400000).toISOString();
      }
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return pat;
  },

  getRecent(n) {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return [];
    return patterns.patterns
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, n || 5);
  },

  getHighConfidence(threshold) {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return [];
    return patterns.patterns
      .filter(p => p.confidence >= (threshold || 0.8))
      .sort((a, b) => b.confidence - a.confidence);
  },

  migrate() {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns || patterns.patterns.length === 0) return;
    let migrated = false;
    for (const pat of patterns.patterns) {
      if (!pat.source) {
        pat.source = 'sprint_review';
        pat.trust = 'medium';
        pat.status = 'active';
        pat.ttl_days = 90;
        pat.why = pat.why || null;
        pat.last_reinforced_at = pat.last_reinforced_at || null;
        pat.source_reference = pat.source_sprint || null;
        pat.expires_at = pat.created_at
          ? new Date(new Date(pat.created_at).getTime() + 90 * 86400000).toISOString()
          : null;
        delete pat.source_sprint;
        migrated = true;
      }
    }
    if (migrated) {
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return migrated;
  },

  getExpiring(withinDays) {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return [];
    const horizon = new Date(Date.now() + (withinDays || 14) * 86400000).toISOString();
    return patterns.patterns.filter(p =>
      p.status === 'active' && p.expires_at && p.expires_at <= horizon
    );
  },

  expireSweep() {
    const patterns = loadState('patterns');
    if (!patterns || !patterns.patterns) return 0;
    const today = now();
    let expired = 0;
    for (const pat of patterns.patterns) {
      if (pat.status === 'active' && pat.expires_at && pat.expires_at <= today) {
        pat.status = 'expired';
        expired++;
      }
    }
    if (expired > 0) {
      patterns.last_updated = now();
      saveState('patterns', patterns);
    }
    return expired;
  },

  getStaged() {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    return staging.patterns;
  },

  addStaged(opts) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const confMap = { explicit: 0.9, sprint_review: 0.7, log_analysis: 0.5 };
    const pattern = {
      id: genId('stg'),
      category: opts.category || 'general',
      description: opts.description || '',
      why: opts.why || null,
      source: opts.source || 'log_analysis',
      trust: opts.trust || 'low',
      confidence: opts.confidence != null ? opts.confidence : (confMap[opts.source] || 0.5),
      times_applied: 0,
      ttl_days: opts.ttl_days != null ? opts.ttl_days : 30,
      created_at: now(),
      last_reinforced_at: null,
      source_reference: opts.source_reference || null,
      expires_at: null,
      status: 'staged',
    };
    staging.patterns.push(pattern);
    staging.last_updated = now();
    saveState('staging', staging);
    return pattern;
  },

  approveStaged(patternId) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const idx = staging.patterns.findIndex(p => p.id === patternId);
    if (idx === -1) return null;

    const pat = staging.patterns[idx];
    staging.patterns.splice(idx, 1);
    staging.last_updated = now();
    saveState('staging', staging);

    return PatternManager.addPattern({
      category: pat.category,
      description: pat.description,
      why: pat.why,
      source: pat.source,
      trust: pat.trust,
      confidence: pat.confidence,
      ttl_days: pat.ttl_days,
      source_reference: pat.source_reference,
    });
  },

  rejectStaged(patternId) {
    const staging = loadState('staging') || { patterns: [], last_updated: null };
    const idx = staging.patterns.findIndex(p => p.id === patternId);
    if (idx === -1) return false;
    staging.patterns.splice(idx, 1);
    staging.last_updated = now();
    saveState('staging', staging);
    return true;
  },

  getLearningHealth() {
    const patterns = loadState('patterns') || { patterns: [] };
    const staging = loadState('staging') || { patterns: [] };
    const active = patterns.patterns.filter(p => p.status === 'active');
    const expiring = PatternManager.getExpiring(14);
    return {
      active: active.length,
      high_trust: active.filter(p => p.trust === 'high').length,
      medium_trust: active.filter(p => p.trust === 'medium').length,
      low_trust: active.filter(p => p.trust === 'low').length,
      staged: staging.patterns.length,
      expiring: expiring.length,
      expired: patterns.patterns.filter(p => p.status === 'expired').length,
      archived: patterns.patterns.filter(p => p.status === 'archived').length,
    };
  },
};

// ---------------------------------------------------------------------------
// 8. Summary helpers
// ---------------------------------------------------------------------------

const SummaryHelper = {
  compressSprint(sprintId) {
    const sprint = loadState('sprint');
    const tasks = TaskManager.getSprintTasks(sprintId || (sprint && sprint.sprint_id));
    if (!sprint) return null;

    const summary = {
      sprint_id: sprint.sprint_id,
      goal: sprint.goal,
      status: sprint.status,
      tasks_completed: tasks.filter(t => t.status === 'completed').length,
      tasks_total: tasks.length,
      files_touched: [...new Set(tasks.flatMap(t => t.files_modified || []))],
      blockers_encountered: sprint.blockers ? sprint.blockers.length : 0,
      compressed_at: now(),
    };

    // Add to context summaries
    const ctx = loadState('context') || {
      last_context_pack: null, loaded_governance: [],
      loaded_rules: [], active_summaries: [],
      compression_log: [], freshness_check_at: null,
    };
    ctx.active_summaries.push(summary);
    ctx.compression_log.push({
      sprint_id: sprint.sprint_id,
      compressed_at: now(),
      summary_size: JSON.stringify(summary).length,
    });

    // Keep summaries under budget (max 10)
    if (ctx.active_summaries.length > 10) {
      ctx.active_summaries = ctx.active_summaries.slice(-10);
    }
    ctx.freshness_check_at = now();
    saveState('context', ctx);

    return summary;
  },
};

// ---------------------------------------------------------------------------
// 9. Status reporting
// ---------------------------------------------------------------------------

const StatusReporter = {
  generate() {
    const project = loadState('project');
    const roadmap = loadState('roadmap');
    const sprint = loadState('sprint');
    const patterns = loadState('patterns');

    if (!project || !project.initialized_at) {
      return 'BuildOS not initialized. Run /build-init first.';
    }

    const roadmapStats = RoadmapManager.getStats();
    const sprintTasks = sprint && sprint.sprint_id
      ? TaskManager.getStats(sprint.sprint_id)
      : { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 };

    const recentPatterns = PatternManager.getRecent(5);
    const epicPercent = roadmapStats.total > 0
      ? Math.round((roadmapStats.completed / roadmapStats.total) * 100)
      : 0;

    const blockers = sprint && sprint.blockers
      ? sprint.blockers.filter(b => !b.resolved)
      : [];

    let output = '';
    output += 'BuildOS Status Dashboard\n';
    output += '========================\n\n';
    output += `Project: ${project.name || '(unnamed)'}\n`;
    output += `  Initialized: ${project.initialized_at || 'N/A'}  |  Governance: ${project.governance_version || 'N/A'}\n`;
    output += `  Sprints Completed: ${project.total_sprints_completed || 0}\n\n`;

    output += `Roadmap: ${roadmapStats.completed}/${roadmapStats.total} epics\n`;
    output += `  Phase: ${roadmapStats.phase || 'N/A'}\n`;

    // Progress bar
    const barLen = 20;
    const filled = Math.round((epicPercent / 100) * barLen);
    output += `  [${'='.repeat(filled)}${'-'.repeat(barLen - filled)}] ${epicPercent}%\n\n`;

    if (sprint && sprint.sprint_id) {
      output += `Active Sprint: ${sprint.sprint_id}\n`;
      output += `  Goal: ${sprint.goal || 'N/A'}\n`;
      output += `  Status: ${sprint.status || 'N/A'}  |  Started: ${sprint.started_at || 'N/A'}\n`;
      output += `  Tasks: ${sprintTasks.completed}/${sprintTasks.total} (${sprintTasks.blocked} blocked)\n\n`;

      // Current task
      const current = TaskManager.getNextPending(sprint.sprint_id);
      if (current) {
        output += `Next Task: ${current.id} — ${current.title}\n`;
        output += `  Type: ${current.type}  |  Status: ${current.status}\n\n`;
      }
    } else {
      output += 'Active Sprint: none\n\n';
    }

    output += `Blockers: ${blockers.length} active\n`;
    if (blockers.length > 0) {
      for (const b of blockers) {
        output += `  - ${b.description} (since ${b.created_at})\n`;
      }
    }
    output += '\n';

    output += `Last Review: ${project.last_review || 'N/A'}\n\n`;

    output += `Recent Patterns: ${recentPatterns.length} learned\n`;
    for (const p of recentPatterns) {
      output += `  - [${p.category}] ${p.description} (confidence: ${p.confidence})\n`;
    }

    // Learning Health
    const health = PatternManager.getLearningHealth();
    output += '\n';
    output += 'Learning Health\n';
    output += `├─ Active patterns: ${health.active} (${health.high_trust} high, ${health.medium_trust} medium, ${health.low_trust} low trust)\n`;
    output += `├─ Staged (pending review): ${health.staged}\n`;
    output += `├─ Expiring within 14 days: ${health.expiring}\n`;
    output += `├─ Expired: ${health.expired}\n`;
    output += `└─ Archived: ${health.archived}\n`;

    return output;
  },
};

// ---------------------------------------------------------------------------
// DAGBuilder — topological sort sprint tasks into parallelizable waves
// ---------------------------------------------------------------------------

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

const TIER3_KEYWORDS = ['migrate', 'auth', 'schema', 'security', 'perf', 'migration', 'performance'];
const TIER2_KEYWORDS = ['integrate', 'connect', 'extend'];

const DAGBuilder = {
  build(tasks) {
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) {
      return { error: 'No pending tasks to execute.' };
    }

    const taskMap = new Map(pending.map(t => [t.id, t]));
    const inDegree = new Map();
    const adjList = new Map();

    for (const t of pending) {
      inDegree.set(t.id, 0);
      adjList.set(t.id, []);
    }

    for (const t of pending) {
      for (const dep of (t.depends_on || [])) {
        if (!taskMap.has(dep)) continue;
        adjList.get(dep).push(t.id);
        inDegree.set(t.id, inDegree.get(t.id) + 1);
      }
    }

    const queue = [];
    const depth = new Map();
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
        depth.set(id, 0);
      }
    }

    const sorted = [];
    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      processed++;

      for (const neighbor of adjList.get(current)) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        const newDepth = Math.max(depth.get(neighbor) || 0, depth.get(current) + 1);
        depth.set(neighbor, newDepth);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (processed !== pending.length) {
      const inCycle = pending.filter(t => !sorted.includes(t.id)).map(t => t.id);
      return { error: `Cycle detected in task dependencies: ${inCycle.join(' → ')}. Fix task dependencies before running --parallel.` };
    }

    const waveMap = new Map();
    for (const [id, d] of depth) {
      if (!waveMap.has(d)) waveMap.set(d, []);
      waveMap.get(d).push(id);
    }

    const waves = [];
    const sortedDepths = [...waveMap.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedDepths.length; i++) {
      waves.push({
        id: i + 1,
        units: waveMap.get(sortedDepths[i]).sort(),
      });
    }

    const maxConcurrency = Math.max(...waves.map(w => w.units.length));
    const parallelizable = maxConcurrency > 1;

    return { waves, parallelizable, max_concurrency: maxConcurrency };
  },

  tier(tasks) {
    const result = {};
    for (const t of tasks) {
      const desc = (t.description || '').toLowerCase() + ' ' + (t.title || '').toLowerCase();
      const fileCount = (t.file_scope || []).length;

      const hasTier3Keyword = TIER3_KEYWORDS.some(kw => desc.includes(kw));
      if (hasTier3Keyword || fileCount >= 7) {
        result[t.id] = { tier: 3, model: 'opus', reason: hasTier3Keyword ? 'keyword match' : 'file count >= 7' };
        continue;
      }

      const hasTier2Keyword = TIER2_KEYWORDS.some(kw => desc.includes(kw));
      if (hasTier2Keyword || fileCount >= 3) {
        result[t.id] = { tier: 2, model: 'sonnet', reason: hasTier2Keyword ? 'keyword match' : 'file count 3-6' };
        continue;
      }

      result[t.id] = { tier: 1, model: 'sonnet', reason: 'isolated change' };
    }
    return result;
  },

  recalculate(tasks) {
    return this.build(tasks);
  },
};

// ---------------------------------------------------------------------------
// LedgerManager — execution ledger for wave-based parallel execution
// ---------------------------------------------------------------------------

const LedgerManager = {
  _ledgerPath() {
    return stateFile('ledger');
  },

  _wavePath(waveId) {
    return path.join(WAVES_DIR, `wave-${waveId}.json`);
  },

  _snapshotPath(waveId, unitId) {
    return path.join(WAVES_DIR, `wave-${waveId}-${unitId}-snapshot.json`);
  },

  init(sprintId) {
    if (!fs.existsSync(WAVES_DIR)) {
      fs.mkdirSync(WAVES_DIR, { recursive: true });
    }
    const ledger = {
      sprint_id: sprintId,
      mode: 'parallel',
      current_wave: 0,
      waves_completed: [],
      decisions: [],
      interfaces_defined: [],
      warnings: [],
      failed_units: [],
    };
    saveJSON(this._ledgerPath(), ledger);
    return ledger;
  },

  load() {
    return loadJSON(this._ledgerPath());
  },

  save(ledger) {
    saveJSON(this._ledgerPath(), ledger);
  },

  appendDecision(wave, unitId, decision) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.decisions.push({
      wave,
      unit_id: unitId,
      type: 'decision',
      description: decision.description,
      files_affected: decision.files_affected || [],
      timestamp: now(),
    });
    this.save(ledger);
  },

  appendInterface(wave, unitId, iface) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.interfaces_defined.push({
      wave,
      unit_id: unitId,
      name: iface.name,
      file: iface.file,
      exports: iface.exports || [],
    });
    this.save(ledger);
  },

  appendWarning(wave, unitId, warning) {
    const ledger = this.load();
    if (!ledger) return;
    ledger.warnings.push({
      wave,
      unit_id: unitId,
      description: warning,
      timestamp: now(),
    });
    this.save(ledger);
  },

  appendFailure(unitId, wave, reason, downstream) {
    const ledger = this.load();
    if (!ledger) return;
    const snapshotPath = this._snapshotPath(wave, unitId);
    ledger.failed_units.push({
      unit_id: unitId,
      wave,
      reason,
      snapshot_path: snapshotPath,
      downstream_blocked: downstream || [],
    });
    this.save(ledger);
    return snapshotPath;
  },

  snapshotWave(waveId, results) {
    const wavePath = this._wavePath(waveId);
    saveJSON(wavePath, {
      wave_id: waveId,
      completed_at: now(),
      results,
    });
    const ledger = this.load();
    if (ledger) {
      ledger.waves_completed.push(waveId);
      ledger.current_wave = waveId;
      this.save(ledger);
    }
  },

  snapshotFailure(waveId, unitId, failureData) {
    const snapshotPath = this._snapshotPath(waveId, unitId);
    saveJSON(snapshotPath, {
      unit_id: unitId,
      wave: waveId,
      failure_reason: failureData.failure_reason || 'unknown',
      partial_work: failureData.partial_work || {},
      worktree_preserved: true,
      downstream_blocked: failureData.downstream_blocked || [],
      retry_hint: failureData.retry_hint || null,
      snapshot_at: now(),
    });
    return snapshotPath;
  },

  getCumulativeLedger(tokenBudget) {
    tokenBudget = tokenBudget || 800;
    const ledger = this.load();
    if (!ledger) return { decisions: [], interfaces_defined: [], warnings: [] };

    const cutoff = Math.max(0, ledger.current_wave - 2);

    const recentDecisions = [];
    const oldSummaries = [];

    for (const d of ledger.decisions) {
      if (d.wave <= cutoff) {
        oldSummaries.push(`Wave ${d.wave}/${d.unit_id}: ${d.description}`);
      } else {
        recentDecisions.push(d);
      }
    }

    const result = {
      current_wave: ledger.current_wave,
      prior_wave_summaries: oldSummaries,
      recent_decisions: recentDecisions,
      interfaces_defined: ledger.interfaces_defined,
      warnings: ledger.warnings,
      failed_units: ledger.failed_units,
    };

    const estimate = TokenCounter.estimate(JSON.stringify(result));
    if (estimate > tokenBudget) {
      result.prior_wave_summaries = oldSummaries.slice(-3);
      result.warnings = ledger.warnings.slice(-5);
    }

    return result;
  },

  finalize() {
    const ledger = this.load();
    if (!ledger) return 'No ledger found.';

    const totalWaves = ledger.waves_completed.length;
    const totalDecisions = ledger.decisions.length;
    const totalFailed = ledger.failed_units.length;
    const totalInterfaces = ledger.interfaces_defined.length;

    const lines = [
      'Ralph Loop Execution Complete',
      `  Sprint: ${ledger.sprint_id}`,
      `  Waves completed: ${totalWaves}`,
      `  Decisions recorded: ${totalDecisions}`,
      `  Interfaces defined: ${totalInterfaces}`,
      `  Failed units: ${totalFailed}`,
    ];

    if (totalFailed > 0) {
      lines.push('  Failed:');
      for (const f of ledger.failed_units) {
        lines.push(`    - ${f.unit_id} (wave ${f.wave}): ${f.reason}`);
        if (f.downstream_blocked.length > 0) {
          lines.push(`      Blocked: ${f.downstream_blocked.join(', ')}`);
        }
      }
    }

    return lines.join('\n');
  },

  cleanup() {
    const ledgerPath = this._ledgerPath();
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
    if (fs.existsSync(WAVES_DIR)) {
      const files = fs.readdirSync(WAVES_DIR);
      for (const f of files) {
        fs.unlinkSync(path.join(WAVES_DIR, f));
      }
      fs.rmdirSync(WAVES_DIR);
    }
  },
};

// ---------------------------------------------------------------------------
// MergeValidator — check for file conflicts between parallel units
// ---------------------------------------------------------------------------

const MergeValidator = {
  validate(unitReports) {
    const fileOwnership = new Map();

    for (const report of unitReports) {
      const allFiles = [
        ...(report.files_modified || []),
        ...(report.files_created || []),
      ];
      for (const file of allFiles) {
        if (!fileOwnership.has(file)) fileOwnership.set(file, []);
        fileOwnership.get(file).push(report.unit_id);
      }
    }

    const conflicts = [];
    for (const [file, units] of fileOwnership) {
      if (units.length > 1) {
        conflicts.push({ file, units });
      }
    }

    if (conflicts.length > 0) {
      return {
        valid: false,
        conflicts,
        message: conflicts.map(c =>
          `✗ Units ${c.units.join(' and ')} both touched ${c.file}\n  Fix: Add dependency between tasks ${c.units.join(' → ')} (or reverse)`
        ).join('\n'),
      };
    }

    return { valid: true };
  },
};

// ---------------------------------------------------------------------------
// SecurityScanner — SAST/SCA/DAST scanning with tool detection
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

  detectTools() {
    const tools = {};
    const semgrepVer = this._exec('semgrep --version');
    tools.semgrep = { available: !!semgrepVer, version: semgrepVer?.trim() || null };

    const sonarVer = this._exec('sonar-scanner --version 2>&1');
    tools.sonar_scanner = {
      available: !!sonarVer && sonarVer.includes('SonarScanner'),
      version: sonarVer ? (sonarVer.match(/SonarScanner ([\d.]+)/)?.[1] || null) : null,
    };

    const dockerAvail = this._exec('docker ps', { timeout: 5000 });
    const zapShAvail = this._exec('zap.sh -cmd -version 2>&1', { timeout: 10000 });
    tools.zap = {
      available: !!(dockerAvail || zapShAvail),
      method: dockerAvail ? 'docker' : (zapShAvail ? 'zap.sh' : null),
      version: null,
    };

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
    const output = result.output || result.error;
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
    for (const f of result.findings) { summary[f.severity]++; }
    const posture = this._getPosture();
    const thresholds = POSTURE_THRESHOLDS[posture] || POSTURE_THRESHOLDS.moderate;
    let blocked = false;
    for (const sev of SEVERITY_LEVELS) {
      if (summary[sev] > 0 && thresholds[sev] === 'block') { blocked = true; break; }
    }
    const state = this._loadScanState();
    state.findings = this._mergeFindings(state.findings, result.findings);
    state.last_scan = {
      type: 'files', timestamp: now(),
      tools_used: result.skipped ? [] : ['semgrep'],
      tools_errored: result.error ? ['semgrep'] : [],
      summary,
    };
    state.scan_history.push({
      timestamp: now(), type: 'files', files_scanned: files.length,
      findings_count: result.findings.length, tools_used: result.skipped ? [] : ['semgrep'],
    });
    if (state.scan_history.length > 50) { state.scan_history = state.scan_history.slice(-50); }
    this._saveScanState(state);
    return { findings: result.findings, summary, blocked, posture, error: result.error };
  },

  _deduplicateFindings(findings) {
    const seen = new Map();
    const deduped = [];
    for (const f of findings) {
      if (f.cwe) {
        const key = `${f.file}:${f.line}:${f.cwe}`;
        if (seen.has(key)) {
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

  _mergeFindings(existing, newFindings) {
    const preserved = existing.filter(f => f.status === 'dismissed' || f.status === 'false_positive');
    const newKeys = new Set(newFindings.map(f => `${f.file}:${f.line}:${f.rule}`));
    const autoResolved = existing
      .filter(f => f.status === 'open' && !newKeys.has(`${f.file}:${f.line}:${f.rule}`))
      .map(f => ({ ...f, status: 'resolved', resolved_at: now() }));
    const combined = [...preserved, ...autoResolved, ...newFindings];
    return this._deduplicateFindings(combined);
  },

  _mapSonarSeverity(severity) {
    const map = { BLOCKER: 'critical', CRITICAL: 'high', MAJOR: 'medium', MINOR: 'low', INFO: 'low' };
    return map[severity] || 'low';
  },

  _pollSonarTask(serverUrl, projectKey, token, maxWaitMs) {
    const maxWait = maxWaitMs || 300000;
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
    const scanCmd = `sonar-scanner -Dsonar.projectKey=${config.sonarqube_project_key} -Dsonar.host.url=${config.sonarqube_url} ${tokenFlag}`;
    const scanResult = this._execOrError(scanCmd, { timeout: 300000 });
    if (scanResult.error && !scanResult.output) {
      return { findings: [], error: `sonar-scanner failed: ${scanResult.error}`, skipped: false };
    }
    const taskStatus = this._pollSonarTask(config.sonarqube_url, config.sonarqube_project_key, token);
    if (taskStatus !== 'SUCCESS') {
      return { findings: [], error: `SonarQube analysis ${taskStatus}`, skipped: false };
    }
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

  // --- Tasks 5-6 will add more methods here ---
};

// ---------------------------------------------------------------------------
// 10. Hook helpers
// ---------------------------------------------------------------------------

// Hook call counter — tracks invocations to reduce redundant output
const HOOK_COUNTER_FILE = path.join(STATE_DIR, '.hook-counts.json');

function getHookCounts() {
  return loadJSON(HOOK_COUNTER_FILE) || { preBash: 0, preEdit: 0, postEdit: 0, postBash: 0 };
}

function incrementHook(name) {
  const counts = getHookCounts();
  counts[name] = (counts[name] || 0) + 1;
  saveJSON(HOOK_COUNTER_FILE, counts);
  return counts[name];
}

const Hooks = {
  preBash() {
    if (!StateManager.isInitialized()) return '';
    const count = incrementHook('preBash');

    // Full reminder on first call, minimal on subsequent
    if (count === 1) {
      const sprint = SprintManager.getActive();
      let msg = '--- BuildOS Active ---\n';
      msg += 'Governance: coding-rules.md, architecture-principles.md\n';
      if (sprint) {
        msg += `Sprint: ${sprint.sprint_id} — ${sprint.goal}\n`;
        msg += `Scope: ${sprint.in_scope.join(', ') || 'see sprint state'}\n`;
      }
      return msg;
    }
    // Subsequent calls: silent (governance already loaded in context)
    return '';
  },

  preEdit() {
    if (!StateManager.isInitialized()) return '';
    const count = incrementHook('preEdit');

    // Only remind scope on first edit, not every file
    if (count === 1) {
      const sprint = SprintManager.getActive();
      if (!sprint) return '';
      return `--- BuildOS Scope: ${sprint.in_scope.join(', ') || 'see sprint'} ---`;
    }
    return '';
  },

  postEdit() {
    // Removed: quality gate reminder on every edit wastes context.
    // Governance rules are loaded at session start and in context packs.
    return '';
  },

  postBash() {
    if (!StateManager.isInitialized()) return '';
    const sprint = SprintManager.getActive();
    if (!sprint) return '';

    const count = incrementHook('postBash');
    const stats = TaskManager.getStats(sprint.sprint_id);

    // Only report on milestone events, not every bash call
    if (stats.completed === stats.total && stats.total > 0) {
      return `BuildOS: All ${stats.total} tasks complete. Run /build-verify.`;
    }
    // Report progress every 5th call to reduce noise
    if (count % 5 === 0) {
      return `BuildOS: ${stats.completed}/${stats.total} tasks.`;
    }
    return '';
  },

  sessionStart() {
    // Reset hook counters for new session
    saveJSON(HOOK_COUNTER_FILE, { preBash: 0, preEdit: 0, postEdit: 0, postBash: 0 });

    if (!StateManager.isInitialized()) {
      return 'BuildOS: Not initialized. Run /build-init.';
    }
    const project = loadState('project');
    const sprint = SprintManager.getActive();

    // Pre-warm caches at session start
    Governance.loadRules();
    if (sprint) {
      ContextCache.isSprintCurrent(sprint.sprint_id);
    }

    // Run migration if needed (one-time)
    PatternManager.migrate();

    // Expire sweep
    const expired = PatternManager.expireSweep();

    let msg = `BuildOS: "${project.name}" | Gov: ${project.governance_version}\n`;
    if (sprint) {
      const stats = TaskManager.getStats(sprint.sprint_id);
      msg += `Sprint: ${sprint.sprint_id} — ${sprint.goal} (${stats.completed}/${stats.total})\n`;
    } else {
      msg += 'No active sprint.\n';
    }

    // Learning nudge
    const staged = PatternManager.getStaged();
    const expiring = PatternManager.getExpiring(14);
    if (staged.length > 0 || expiring.length > 0) {
      const parts = [];
      if (staged.length > 0) parts.push(`${staged.length} patterns pending review`);
      if (expiring.length > 0) parts.push(`${expiring.length} expiring soon`);
      msg += `Learning: ${parts.join(', ')}. Run /build-audit when ready.\n`;
    }
    if (expired > 0) {
      msg += `Expired: ${expired} patterns marked expired this session.\n`;
    }

    return msg;
  },

  stop() {
    if (!StateManager.isInitialized()) return '';
    const ctx = loadState('context');
    if (ctx) {
      ctx.freshness_check_at = now();
      saveState('context', ctx);
    }
    // Clean up session cache
    ContextCache.clear();
    try { fs.unlinkSync(HOOK_COUNTER_FILE); } catch { /* ignore */ }
    return 'BuildOS: Session persisted, cache cleared.';
  },
};

// ---------------------------------------------------------------------------
// 11. Validation helpers
// ---------------------------------------------------------------------------

const Validators = {
  checkSprintState() {
    const sprint = loadState('sprint');
    const issues = [];
    if (!sprint) { issues.push('Sprint state file missing'); return { valid: false, issues }; }
    if (sprint.status === 'active' && !sprint.goal) issues.push('Active sprint has no goal');
    if (sprint.status === 'active' && sprint.acceptance_criteria.length === 0) {
      issues.push('Active sprint has no acceptance criteria');
    }
    if (sprint.status === 'active' && sprint.tasks.length === 0) {
      issues.push('Active sprint has no tasks');
    }
    return { valid: issues.length === 0, issues };
  },

  checkTaskState() {
    const tasks = loadState('task');
    const issues = [];
    if (!tasks) { issues.push('Task state file missing'); return { valid: false, issues }; }
    for (const t of tasks.tasks) {
      if (!t.id) issues.push('Task missing id');
      if (!t.title) issues.push(`Task ${t.id} missing title`);
      if (t.status === 'completed' && !t.completed_at) {
        issues.push(`Task ${t.id} marked completed but no completed_at`);
      }
    }
    return { valid: issues.length === 0, issues };
  },

  checkGovernance() {
    const brain = Governance.checkBrainFiles();
    const issues = [];
    if (!brain.ok) {
      issues.push(`Missing governance files: ${brain.missing.join(', ')}`);
    }
    return { valid: issues.length === 0, issues };
  },
};

// ---------------------------------------------------------------------------
// Command routing
// ---------------------------------------------------------------------------

const Commands = {
  init(args) {
    const name = args[0] || 'Unnamed Project';
    const description = args[1] || '';

    // Check governance
    const govCheck = Governance.checkBrainFiles();
    const govVersion = Governance.computeVersion();
    const rules = Governance.loadRules();

    // Initialize state
    StateManager.resetAll();

    // Set project
    const project = loadState('project');
    project.name = name;
    project.description = description;
    project.initialized_at = now();
    project.governance_version = govVersion;
    saveState('project', project);

    // Set context
    const ctx = loadState('context');
    ctx.loaded_governance = rules.filter(r => r.loaded).map(r => r.file);
    ctx.loaded_rules = rules.map(r => r.file);
    ctx.freshness_check_at = now();
    saveState('context', ctx);

    console.log('BuildOS Initialized');
    console.log(`  Project: ${name}`);
    console.log(`  Governance: ${govVersion} (${rules.filter(r => r.loaded).length} brain files loaded)`);
    if (!govCheck.ok) {
      console.log(`  WARNING: Missing governance files: ${govCheck.missing.join(', ')}`);
    }
    console.log('  State: All 7 state files created');
    console.log('  Ready for: /build-plan');
  },

  plan(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized. Run /build-init first.');
      process.exit(1);
    }
    ContextPack.assemble('planning');
    const roadmap = loadState('roadmap');
    const stats = RoadmapManager.getStats();
    console.log('Context pack assembled: planning');
    console.log(`Roadmap: ${stats.total} epics, phase: ${stats.phase || 'none'}`);
    console.log('Ready for epic definition. Use add-epic subcommand or define via slash command.');
  },

  sprint(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized. Run /build-init first.');
      process.exit(1);
    }
    if (SprintManager.isActive()) {
      const active = SprintManager.getActive();
      console.log(`Sprint already active: ${active.sprint_id} — ${active.goal}`);
      console.log('Complete or cancel current sprint before starting a new one.');
      return;
    }
    ContextPack.assemble('execution');
    console.log('Context pack assembled: execution');
    console.log('Ready for sprint definition via slash command.');
  },

  execute(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized. Run /build-init first.');
      process.exit(1);
    }
    const sprint = SprintManager.getActive();
    if (!sprint) {
      console.error('No active sprint. Run /build-sprint first.');
      process.exit(1);
    }
    ContextPack.assemble('execution');
    const next = TaskManager.getNextPending(sprint.sprint_id);
    if (!next) {
      console.log('All tasks completed for this sprint.');
      console.log('Run /build-verify to validate sprint output.');
      return;
    }
    TaskManager.startTask(next.id);
    const stats = TaskManager.getStats(sprint.sprint_id);
    console.log(`Executing task: ${next.id} — ${next.title}`);
    console.log(`  Type: ${next.type}`);
    console.log(`  Sprint progress: ${stats.completed}/${stats.total}`);
  },

  verify(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized.');
      process.exit(1);
    }
    const sprint = loadState('sprint');
    if (!sprint || !sprint.sprint_id) {
      console.error('No sprint to verify.');
      process.exit(1);
    }
    const stats = TaskManager.getStats(sprint.sprint_id);
    const govCheck = Validators.checkGovernance();
    console.log(`Verifying sprint: ${sprint.sprint_id}`);
    console.log(`  Tasks: ${stats.completed}/${stats.total} completed`);
    console.log(`  Acceptance criteria: ${sprint.acceptance_criteria.length} defined`);
    console.log(`  Governance: ${govCheck.valid ? 'OK' : govCheck.issues.join(', ')}`);
  },

  review(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized.');
      process.exit(1);
    }
    ContextPack.assemble('review');
    const project = loadState('project');
    project.last_review = now();
    saveState('project', project);
    console.log('Context pack assembled: review');
    console.log('Ready for deep governance review via slash command.');
  },

  learn(args) {
    if (!StateManager.isInitialized()) {
      console.error('BuildOS not initialized.');
      process.exit(1);
    }
    const sprint = loadState('sprint');
    if (!sprint || !sprint.sprint_id) {
      console.error('No sprint to learn from.');
      process.exit(1);
    }

    // Compress sprint
    const summary = SummaryHelper.compressSprint(sprint.sprint_id);
    if (summary) {
      console.log(`Sprint compressed: ${sprint.sprint_id}`);
      console.log(`  Tasks completed: ${summary.tasks_completed}/${summary.tasks_total}`);
      console.log(`  Files touched: ${summary.files_touched.length}`);
    }

    // Complete sprint if active
    if (sprint.status === 'active') {
      SprintManager.complete();
      ContextCache.clear(); // Invalidate session cache on sprint completion
      console.log('Sprint marked as completed.');
    }

    const project = loadState('project');
    console.log(`Total sprints completed: ${project.total_sprints_completed}`);
    console.log('Ready for /build-sprint (next sprint) or /build-status.');
  },

  status(args) {
    console.log(StatusReporter.generate());
  },

  ingest(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const filePath = args[0];
    if (!filePath) {
      console.error('Usage: build-tools.cjs ingest <file-path>');
      console.error('Provide a log file path to analyze.');
      process.exit(1);
    }
    const patterns = loadState('patterns') || { patterns: [] };
    const staging = loadState('staging') || { patterns: [] };
    console.log(`Ingest: Analyzing ${filePath}`);
    console.log(`Existing patterns: ${patterns.patterns.length} | Staged: ${staging.patterns.length}`);
    console.log('Use /build-ingest command to run full LLM-driven analysis.');
  },

  audit(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const mode = args[0] || 'full';
    const validModes = ['staged', 'expiring', 'full'];
    if (!validModes.includes(mode)) {
      console.error(`Invalid mode: ${mode}. Use: ${validModes.join(', ')}`);
      process.exit(1);
    }

    if (mode === 'staged' || mode === 'full') {
      const staged = PatternManager.getStaged();
      console.log(`\nStaged Patterns: ${staged.length} pending review`);
      for (const p of staged) {
        console.log(`  ${p.id} [${p.category}] ${p.description}`);
        if (p.why) console.log(`    Why: ${p.why}`);
      }
    }

    if (mode === 'expiring' || mode === 'full') {
      const expiring = PatternManager.getExpiring(14);
      console.log(`\nExpiring Patterns: ${expiring.length} within 14 days`);
      for (const p of expiring) {
        console.log(`  ${p.id} [${p.category}] ${p.description} (expires: ${p.expires_at})`);
      }
    }

    if (mode === 'full') {
      const health = PatternManager.getLearningHealth();
      console.log(`\nLearning Health`);
      console.log(`├─ Active patterns: ${health.active} (${health.high_trust} high, ${health.medium_trust} medium, ${health.low_trust} low trust)`);
      console.log(`├─ Staged (pending review): ${health.staged}`);
      console.log(`├─ Expiring within 14 days: ${health.expiring}`);
      console.log(`├─ Expired: ${health.expired}`);
      console.log(`└─ Archived: ${health.archived}`);
    }
  },

  remember(args) {
    if (!StateManager.isInitialized()) {
      console.error('Not initialized. Run /build-init.');
      process.exit(1);
    }
    const description = args[0] || '';
    const why = args[1] || '';
    if (!description) {
      console.error('Usage: build-tools.cjs remember <description> <why>');
      process.exit(1);
    }
    if (!why) {
      console.error('A "why" reason is required. No naked rules without reasoning.');
      console.error('Usage: build-tools.cjs remember <description> <why>');
      process.exit(1);
    }
    const pat = PatternManager.addPattern({
      category: 'explicit',
      description,
      why: why || null,
      source: 'explicit',
      trust: 'high',
      ttl_days: 0,
      confidence: 0.9,
    });
    if (pat.error) {
      console.error(pat.error);
      process.exit(1);
    }
    console.log(`Pattern Saved (explicit / high trust / evergreen)`);
    console.log(`  [${pat.category}] ${pat.description}`);
    if (pat.why) console.log(`  Why: ${pat.why}`);
    console.log(`  ID: ${pat.id}`);
  },

  // --- Sub-operations called by hooks and commands ---

  'add-epic': function(args) {
    const title = args[0] || 'Untitled Epic';
    const priority = args[1] || 'medium';
    const epic = RoadmapManager.addEpic(title, [], [], priority, 1);
    console.log(`Epic added: ${epic.id} — ${title} (${priority})`);
  },

  'add-task': function(args) {
    const title = args[0] || 'Untitled Task';
    const type = args[1] || 'implement';
    const sprint = SprintManager.getActive();
    if (!sprint) {
      console.error('No active sprint.');
      process.exit(1);
    }
    const task = TaskManager.addTask(title, type, sprint.sprint_id);
    console.log(`Task added: ${task.id} — ${title} (${type})`);
  },

  'complete-task': function(args) {
    const taskId = args[0];
    const filesModified = args.slice(1);
    if (!taskId) {
      console.error('Usage: complete-task <taskId> [files...]');
      process.exit(1);
    }
    const task = TaskManager.completeTask(taskId, filesModified);
    if (task) {
      console.log(`Task completed: ${task.id} — ${task.title}`);
    } else {
      console.error(`Task not found: ${taskId}`);
    }
  },

  'add-pattern': function(args) {
    const category = args[0] || 'general';
    const description = args[1] || '';
    const sprint = loadState('sprint');
    const sprintId = sprint ? sprint.sprint_id : null;
    const pat = PatternManager.addPattern({
      category,
      description,
      source: 'sprint_review',
      source_reference: sprintId,
    });
    if (pat.error) {
      console.error(pat.error);
      process.exit(1);
    }
    console.log(`Pattern recorded: ${pat.id} — [${category}] ${description}`);
  },

  'add-blocker': function(args) {
    const desc = args.join(' ') || 'Unspecified blocker';
    const sprint = SprintManager.addBlocker(desc);
    if (sprint) {
      console.log(`Blocker added to sprint ${sprint.sprint_id}`);
    } else {
      console.error('No active sprint.');
    }
  },

  validate(args) {
    const target = args[0] || 'all';
    const results = {};
    if (target === 'all' || target === 'sprint') results.sprint = Validators.checkSprintState();
    if (target === 'all' || target === 'task') results.task = Validators.checkTaskState();
    if (target === 'all' || target === 'governance') results.governance = Validators.checkGovernance();
    for (const [key, result] of Object.entries(results)) {
      console.log(`${key}: ${result.valid ? 'VALID' : 'INVALID'}`);
      if (!result.valid) {
        for (const issue of result.issues) console.log(`  - ${issue}`);
      }
    }
  },

  dag(args) {
    const sub = args[0];
    if (!sub || !['build', 'tier', 'recalculate'].includes(sub)) {
      console.error('Usage: dag <build|tier|recalculate>');
      process.exit(1);
    }

    const taskState = loadState('task');
    if (!taskState || !taskState.tasks || taskState.tasks.length === 0) {
      console.error('No tasks found in task-state.json');
      process.exit(1);
    }

    if (sub === 'build' || sub === 'recalculate') {
      const result = DAGBuilder.build(taskState.tasks);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'tier') {
      const pending = taskState.tasks.filter(t => t.status === 'pending');
      const result = DAGBuilder.tier(pending);
      console.log(JSON.stringify(result, null, 2));
    }
  },

  ledger(args) {
    const sub = args[0];
    if (!sub || !['init', 'read', 'update', 'finalize', 'cleanup'].includes(sub)) {
      console.error('Usage: ledger <init|read|update|finalize|cleanup>');
      process.exit(1);
    }

    if (sub === 'init') {
      const sprint = loadState('sprint');
      const sprintId = sprint?.active_sprint?.id || 'unknown';
      LedgerManager.init(sprintId);
      console.log(`Ledger initialized for sprint ${sprintId}`);
    } else if (sub === 'read') {
      const budget = parseInt(args[1]) || 800;
      const result = LedgerManager.getCumulativeLedger(budget);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'update') {
      const waveId = parseInt(args[1]);
      if (!waveId) {
        console.error('Usage: ledger update <wave-number> [results-json-path]');
        process.exit(1);
      }
      let results = [];
      if (args[2]) {
        try {
          if (fs.existsSync(args[2])) {
            results = JSON.parse(fs.readFileSync(args[2], 'utf-8'));
          } else {
            results = JSON.parse(args[2]);
          }
        } catch {
          console.error('Could not parse wave results. Expected JSON array of unit-report objects.');
          process.exit(1);
        }
      }

      const ledger = LedgerManager.load();
      if (ledger && Array.isArray(results)) {
        for (const report of results) {
          if (report.status === 'completed') {
            for (const d of (report.decisions || [])) {
              LedgerManager.appendDecision(waveId, report.unit_id, d);
            }
            for (const i of (report.interfaces_defined || [])) {
              LedgerManager.appendInterface(waveId, report.unit_id, i);
            }
            for (const w of (report.warnings || [])) {
              LedgerManager.appendWarning(waveId, report.unit_id, w);
            }
          }
        }
      }

      LedgerManager.snapshotWave(waveId, results);
      console.log(`Wave ${waveId} snapshot saved. Ledger updated with ${results.length} unit reports.`);
    } else if (sub === 'finalize') {
      console.log(LedgerManager.finalize());
    } else if (sub === 'cleanup') {
      LedgerManager.cleanup();
      console.log('Ledger and wave snapshots cleaned up.');
    }
  },

  merge(args) {
    const sub = args[0];
    if (sub !== 'validate') {
      console.error('Usage: merge validate <wave-number> [reports.json]');
      process.exit(1);
    }

    const waveNum = parseInt(args[1]);
    let reports;

    if (args[2] && fs.existsSync(args[2])) {
      try {
        reports = JSON.parse(fs.readFileSync(args[2], 'utf-8'));
      } catch (err) {
        console.error(`Error reading reports file: ${err.message}`);
        process.exit(1);
      }
    } else if (waveNum) {
      const wavePath = path.join(WAVES_DIR, `wave-${waveNum}.json`);
      if (!fs.existsSync(wavePath)) {
        console.error(`Wave snapshot not found: ${wavePath}`);
        process.exit(1);
      }
      try {
        const waveData = JSON.parse(fs.readFileSync(wavePath, 'utf-8'));
        reports = waveData.results || [];
      } catch (err) {
        console.error(`Error reading wave snapshot: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.error('Provide a wave number or reports file path.');
      process.exit(1);
    }

    const result = MergeValidator.validate(Array.isArray(reports) ? reports : [reports]);
    if (result.valid) {
      console.log('PASS — no file conflicts detected.');
    } else {
      console.log('FAIL — file conflicts detected:');
      console.log(result.message);
      process.exit(1);
    }
  },
};

// ---------------------------------------------------------------------------
// Hook dispatch
// ---------------------------------------------------------------------------

function handleHook(hookName) {
  const handlers = {
    'pre-bash': Hooks.preBash,
    'pre-edit': Hooks.preEdit,
    'post-edit': Hooks.postEdit,
    'post-bash': Hooks.postBash,
    'session-start': Hooks.sessionStart,
    'stop': Hooks.stop,
  };
  const handler = handlers[hookName];
  if (!handler) {
    console.error(`Unknown hook: ${hookName}`);
    process.exit(1);
  }
  const output = handler();
  if (output) console.log(output);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('BuildOS CLI — build-tools.cjs');
    console.log('Usage: build-tools.cjs <command> [args...]');
    console.log('');
    console.log('Commands:');
    console.log('  init [name] [description]   Initialize project');
    console.log('  plan                         Prepare planning context');
    console.log('  sprint                       Prepare sprint context');
    console.log('  execute [--parallel] [--max-agents N]  Execute next task (or parallel waves)');
    console.log('  verify                       Verify sprint output');
    console.log('  review                       Prepare review context');
    console.log('  learn                        Compress and record patterns');
    console.log('  status                       Show project status');
    console.log('  add-epic <title> [priority]  Add epic to roadmap');
    console.log('  add-task <title> [type]      Add task to active sprint');
    console.log('  complete-task <id> [files]   Mark task completed');
    console.log('  add-pattern <cat> <desc>     Record learned pattern');
    console.log('  add-blocker <description>    Add blocker to sprint');
    console.log('  ingest <file>                Analyze logs for patterns');
    console.log('  audit [staged|expiring]      Review and manage learned patterns');
    console.log('  remember <desc> <why>        Save explicit teaching pattern');
    console.log('  validate [target]            Validate state files');
    console.log('  dag <build|tier|recalculate> DAG operations for parallel execution');
    console.log('  ledger <init|read|update|finalize|cleanup>  Execution ledger operations');
    console.log('  merge validate <wave> [reports.json]        Validate file conflicts');
    console.log('  hook <hook-name>             Run hook handler');
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  if (command === 'hook') {
    handleHook(commandArgs[0]);
    return;
  }

  const handler = Commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('Run without arguments to see available commands.');
    process.exit(1);
  }

  handler(commandArgs);
}

main();
