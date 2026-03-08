# BuildOS Testing Guide

How to test BuildOS locally without enabling it as a live plugin.

---

## 1. Test the CLI Tool Directly

The CLI tool (`bin/build-tools.cjs`) can be tested standalone without Claude Code.

```bash
cd /home/rohit/Desktop/agents/productivity/build

# Test 1: Status before init (should say "not initialized")
node bin/build-tools.cjs status

# Test 2: Initialize
node bin/build-tools.cjs init

# Test 3: Status after init (should show dashboard)
node bin/build-tools.cjs status

# Test 4: Validate state files
node bin/build-tools.cjs validate

# Test 5: Test hooks
node bin/build-tools.cjs hook session-start
node bin/build-tools.cjs hook pre-bash
node bin/build-tools.cjs hook post-edit
node bin/build-tools.cjs hook stop

# Test 6: Add an epic to roadmap
node bin/build-tools.cjs add-epic "Core data model" "Database schema and migrations"

# Test 7: Add a task
node bin/build-tools.cjs add-task "Create user model" "sprint-001" "implement"

# Test 8: Complete a task
node bin/build-tools.cjs complete-task "<task-id-from-step-7>"

# Test 9: Record a learned pattern
node bin/build-tools.cjs add-pattern "architecture" "Always use UUID primary keys" "sprint-001"

# Test 10: Add a blocker
node bin/build-tools.cjs add-blocker "Waiting for DB credentials"

# Test 11: Check status again (should reflect all changes)
node bin/build-tools.cjs status
```

### Expected results after full test run:

```
BuildOS Status Dashboard
========================

Project: Unnamed Project
  Initialized: <timestamp>  |  Governance: gov-000
  Sprints Completed: 0

Roadmap: 0/1 epics
  Phase: N/A
  [--------------------] 0%

Active Sprint: none

Blockers: 1 active
  - Waiting for DB credentials

Last Review: N/A

Recent Patterns: 1 learned
  - [architecture] Always use UUID primary keys (confidence: 0.5)
```

---

## 2. Test State File Integrity

After running `init`, verify all 6 state files exist and have correct structure:

```bash
# Check all state files exist
ls -la state/

# Inspect each file
cat state/current-project.json | python3 -m json.tool
cat state/roadmap.json | python3 -m json.tool
cat state/sprint-state.json | python3 -m json.tool
cat state/task-state.json | python3 -m json.tool
cat state/context-state.json | python3 -m json.tool
cat state/learned-patterns.json | python3 -m json.tool
```

### Expected schemas:

| File | Key fields |
|------|-----------|
| `current-project.json` | name, initialized_at, governance_version, active_sprint |
| `roadmap.json` | version, epics[], current_phase |
| `sprint-state.json` | sprint_id, goal, status, tasks[], blockers[] |
| `task-state.json` | tasks[{id, title, status, sprint_id}] |
| `context-state.json` | last_context_pack, loaded_governance[], compression_log[] |
| `learned-patterns.json` | patterns[{id, category, description, confidence}] |

---

## 3. Test Governance Files Are Complete

```bash
# All 7 agents exist
ls governance/agents/
# Expected: architect.md  backend-engineer.md  code-reviewer.md
#           documentation-writer.md  platform-engineer.md
#           qa-verifier.md  security-reviewer.md

# All 5 rules exist
ls governance/rules/
# Expected: global.md  java-spring.md  python.md  react.md  typescript.md

# All 5 hooks exist
ls governance/hooks/
# Expected: learn.md  post-merge.md  post-task.md  pre-commit.md  pre-task.md

# All 5 skills exist
ls governance/skills/
# Expected: architecture-patterns.md  code-review.md  security-baseline.md
#           sprint-planning.md  testing-strategy.md

# All brain templates exist
ls governance/brain/
# Expected: architecture.md  domain-model.md  glossary.md
#           non-functional-requirements.md  vision.md  adr/

ls governance/brain/adr/
# Expected: 000-template.md
```

---

## 4. Test Engine Files Are Complete

```bash
# All 6 workflows exist
ls engine/workflows/
# Expected: execute.md  plan.md  release.md  research.md  sprint.md  verify.md

# All 4 execution agents exist
ls engine/agents/
# Expected: executor.md  planner.md  researcher.md  verifier.md

# All 6 templates exist
ls engine/templates/
# Expected: epic-template.md  report-template.md  spec-template.md
#           sprint-template.md  task-template.md  test-template.md
```

---

## 5. Test Context Layer Is Complete

```bash
# All 5 loaders exist
ls context/loaders/
# Expected: load-governance.md  load-history.md  load-module.md
#           load-rules.md  load-sprint.md

# All 4 policies exist
ls context/policies/
# Expected: compression-policy.md  exclusion-policy.md
#           freshness-policy.md  inclusion-policy.md

# All 5 context pack templates exist
ls context/templates/
# Expected: context-pack.md  execution-pack.md  planning-pack.md
#           review-pack.md  sprint-pack.md

# Summary directories exist
ls context/summaries/
# Expected: learned-patterns-summary.md  module-summaries/
#           project-summary.md  sprint-summaries/
```

---

## 6. Test Commands Are Complete

```bash
ls commands/
# Expected: build-execute.md  build-init.md  build-learn.md  build-plan.md
#           build-review.md  build-sprint.md  build-status.md  build-verify.md
```

---

## 7. Test hooks.json Structure

```bash
cat hooks.json | python3 -m json.tool
```

Should contain hook definitions for:
- `PreToolUse` → Bash (governance reminder), Edit|Write (sprint scope check)
- `PostToolUse` → Edit|Write (quality gate), Bash (build check)
- `SessionStart` → load project state
- `Stop` → persist session state

---

## 8. Run the Full Automated Test Suite

Run everything in one go:

```bash
cd /home/rohit/Desktop/agents/productivity/build

echo "=== BuildOS Test Suite ==="

echo "--- Test: Pre-init status ---"
node bin/build-tools.cjs status 2>&1

echo ""
echo "--- Test: Init ---"
node bin/build-tools.cjs init 2>&1

echo ""
echo "--- Test: Post-init status ---"
node bin/build-tools.cjs status 2>&1

echo ""
echo "--- Test: Validate ---"
node bin/build-tools.cjs validate 2>&1

echo ""
echo "--- Test: Add epic ---"
node bin/build-tools.cjs add-epic "Auth system" "User authentication and authorization" 2>&1

echo ""
echo "--- Test: Add task ---"
node bin/build-tools.cjs add-task "Create login endpoint" "sprint-001" "implement" 2>&1

echo ""
echo "--- Test: Add pattern ---"
node bin/build-tools.cjs add-pattern "security" "Always hash passwords with bcrypt" "sprint-001" 2>&1

echo ""
echo "--- Test: Add blocker ---"
node bin/build-tools.cjs add-blocker "Need OAuth provider credentials" 2>&1

echo ""
echo "--- Test: Final status ---"
node bin/build-tools.cjs status 2>&1

echo ""
echo "--- Test: Hook - session-start ---"
node bin/build-tools.cjs hook session-start 2>&1

echo ""
echo "--- Test: Hook - pre-bash ---"
node bin/build-tools.cjs hook pre-bash 2>&1

echo ""
echo "--- Test: Hook - post-edit ---"
node bin/build-tools.cjs hook post-edit 2>&1

echo ""
echo "--- Test: Hook - stop ---"
node bin/build-tools.cjs hook stop 2>&1

echo ""
echo "--- Test: File counts ---"
echo "Governance agents: $(ls governance/agents/*.md 2>/dev/null | wc -l)/7"
echo "Governance rules:  $(ls governance/rules/*.md 2>/dev/null | wc -l)/5"
echo "Governance hooks:  $(ls governance/hooks/*.md 2>/dev/null | wc -l)/5"
echo "Governance skills: $(ls governance/skills/*.md 2>/dev/null | wc -l)/5"
echo "Governance brain:  $(ls governance/brain/*.md 2>/dev/null | wc -l)/5"
echo "Engine workflows:  $(ls engine/workflows/*.md 2>/dev/null | wc -l)/6"
echo "Engine agents:     $(ls engine/agents/*.md 2>/dev/null | wc -l)/4"
echo "Engine templates:  $(ls engine/templates/*.md 2>/dev/null | wc -l)/6"
echo "Context loaders:   $(ls context/loaders/*.md 2>/dev/null | wc -l)/5"
echo "Context policies:  $(ls context/policies/*.md 2>/dev/null | wc -l)/4"
echo "Context templates: $(ls context/templates/*.md 2>/dev/null | wc -l)/5"
echo "Commands:          $(ls commands/*.md 2>/dev/null | wc -l)/8"
echo "State files:       $(ls state/*.json 2>/dev/null | wc -l)/6"

echo ""
echo "=== All tests complete ==="
```

---

## 9. Going Live (When Ready)

When you're satisfied with testing, enable BuildOS as a Claude Code plugin:

### Option A: Project-level (recommended for testing)

Create a `.claude/settings.json` in your project root:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook pre-bash" }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook pre-edit" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook post-edit" }]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook post-bash" }]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook session-start" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node build/bin/build-tools.cjs hook stop" }]
      }
    ]
  }
}
```

### Option B: Global (after full validation)

Add to `~/.claude/settings.json` under `enabledPlugins`.

**Do NOT do this until you've completed all tests above and are confident.**
