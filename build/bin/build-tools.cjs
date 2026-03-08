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

const STATE_FILES = {
  project: 'current-project.json',
  roadmap: 'roadmap.json',
  sprint: 'sprint-state.json',
  task: 'task-state.json',
  context: 'context-state.json',
  patterns: 'learned-patterns.json',
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
    const rules = [];
    for (const f of GOVERNANCE_FILES) {
      const content = readTextFile(path.join(GOV_DIR, f));
      if (content) rules.push({ file: f, loaded: true, size: content.length });
      else rules.push({ file: f, loaded: false, size: 0 });
    }
    return rules;
  },
};

// ---------------------------------------------------------------------------
// 3. Context pack assembly
// ---------------------------------------------------------------------------

const ContextPack = {
  assemble(packName) {
    const pack = { name: packName, files: [], governance: [], timestamp: now() };

    // Always load governance
    const rules = Governance.loadRules();
    pack.governance = rules.filter(r => r.loaded).map(r => r.file);

    // Load pack-specific context file if it exists
    const contextFile = path.join(CONTEXT_DIR, `${packName}-context.md`);
    if (fileExists(contextFile)) {
      pack.files.push(contextFile);
    }

    // Update context state
    const ctx = loadState('context') || {};
    ctx.last_context_pack = packName;
    ctx.loaded_governance = pack.governance;
    ctx.loaded_rules = rules.map(r => r.file);
    ctx.freshness_check_at = now();
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
  addPattern(category, description, sourceSprintId, confidence) {
    const patterns = loadState('patterns') || { patterns: [], last_updated: null };
    const pattern = {
      id: genId('pat'),
      category,
      description,
      source_sprint: sourceSprintId,
      confidence: confidence || 0.7,
      times_applied: 1,
      created_at: now(),
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

    return output;
  },
};

// ---------------------------------------------------------------------------
// 10. Hook helpers
// ---------------------------------------------------------------------------

const Hooks = {
  preBash() {
    if (!StateManager.isInitialized()) return '';
    const sprint = SprintManager.getActive();
    let msg = '--- BuildOS Governance Reminder ---\n';
    msg += 'Follow coding-rules.md and architecture-principles.md.\n';
    if (sprint) {
      msg += `Active sprint: ${sprint.sprint_id} — ${sprint.goal}\n`;
      msg += `Scope: ${sprint.in_scope.join(', ') || 'see sprint state'}\n`;
    }
    return msg;
  },

  preEdit() {
    if (!StateManager.isInitialized()) return '';
    const sprint = SprintManager.getActive();
    if (!sprint) return '';
    let msg = '--- BuildOS Scope Check ---\n';
    msg += `Sprint scope: ${sprint.in_scope.join(', ') || 'all in-scope items'}\n`;
    msg += `Out of scope: ${sprint.out_of_scope.join(', ') || 'none declared'}\n`;
    return msg;
  },

  postEdit() {
    if (!StateManager.isInitialized()) return '';
    let msg = '--- BuildOS Quality Gate ---\n';
    msg += 'Verify: naming conventions, error handling, no hardcoded secrets.\n';
    return msg;
  },

  postBash() {
    if (!StateManager.isInitialized()) return '';
    const sprint = SprintManager.getActive();
    if (!sprint) return '';
    const stats = TaskManager.getStats(sprint.sprint_id);
    let msg = '--- BuildOS Build Check ---\n';
    msg += `Sprint progress: ${stats.completed}/${stats.total} tasks complete.\n`;
    if (stats.completed === stats.total && stats.total > 0) {
      msg += 'All tasks complete! Consider running /build-verify.\n';
    }
    return msg;
  },

  sessionStart() {
    if (!StateManager.isInitialized()) {
      return 'BuildOS: No project initialized. Run /build-init to start.';
    }
    const project = loadState('project');
    const sprint = SprintManager.getActive();
    let msg = `BuildOS: Project "${project.name}" loaded.\n`;
    msg += `Governance: ${project.governance_version}\n`;
    if (sprint) {
      msg += `Active sprint: ${sprint.sprint_id} — ${sprint.goal}\n`;
      const stats = TaskManager.getStats(sprint.sprint_id);
      msg += `Tasks: ${stats.completed}/${stats.total} complete.\n`;
    } else {
      msg += 'No active sprint.\n';
    }
    return msg;
  },

  stop() {
    if (!StateManager.isInitialized()) return '';
    // Persist freshness timestamp
    const ctx = loadState('context');
    if (ctx) {
      ctx.freshness_check_at = now();
      saveState('context', ctx);
    }
    return 'BuildOS: Session state persisted.';
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
    console.log('  State: All 6 state files created');
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
      console.log('Sprint marked as completed.');
    }

    const project = loadState('project');
    console.log(`Total sprints completed: ${project.total_sprints_completed}`);
    console.log('Ready for /build-sprint (next sprint) or /build-status.');
  },

  status(args) {
    console.log(StatusReporter.generate());
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
    const pat = PatternManager.addPattern(category, description, sprintId, 0.7);
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
    console.log('  execute                      Execute next task');
    console.log('  verify                       Verify sprint output');
    console.log('  review                       Prepare review context');
    console.log('  learn                        Compress and record patterns');
    console.log('  status                       Show project status');
    console.log('  add-epic <title> [priority]  Add epic to roadmap');
    console.log('  add-task <title> [type]      Add task to active sprint');
    console.log('  complete-task <id> [files]   Mark task completed');
    console.log('  add-pattern <cat> <desc>     Record learned pattern');
    console.log('  add-blocker <description>    Add blocker to sprint');
    console.log('  validate [target]            Validate state files');
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
