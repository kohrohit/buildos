# OpenSpace Integration — Opt-In Skill Evolution Engine

## Governance Policy

```
STATUS: opt-in only
DEFAULT: disabled
ENABLE: user must explicitly enable via /build-init or /build-status
PROMPT: always ask before first use, never assume
AUTHORITY: BuildOS governance overrides OpenSpace decisions
```

**OpenSpace is NEVER enabled automatically.** The user must explicitly choose to enable it. If not enabled, BuildOS operates exactly as before with zero OpenSpace dependency.

---

## What Is OpenSpace?

[OpenSpace](https://github.com/HKUDS/OpenSpace) is a self-evolving skill engine for AI coding agents. It:

- **Captures** reusable skills from successful task executions
- **Auto-repairs** skills when tools/APIs change (FIX evolution)
- **Derives** specialized variants from general skills (DERIVED evolution)
- **Shares** skills across projects via a cloud community

Integration benefit: repeated tasks (CI setup, REST endpoints, E2E scaffolding) get cheaper each sprint as skills accumulate and self-improve.

---

## Opt-In Flow

### During /build-init

After standard project initialization, prompt:

```
Optional: OpenSpace Skill Evolution Engine
  OpenSpace can capture reusable skills from your sprint executions,
  auto-repair them when tools change, and share them across projects.

  Requirements:
    - Python 3.12+
    - pip install openspace-engine (or clone from GitHub)
    - API key for cloud features (optional)

  Enable OpenSpace integration? (y/n)
```

- If **yes**: set `openspace.enabled: true` in `state/current-project.json`
- If **no**: set `openspace.enabled: false`, never mention OpenSpace again unless user asks

### Via /build-status

Show current OpenSpace status:

```
OpenSpace: {enabled|disabled}
  Skills: {n} local, {n} cloud (if enabled)
  Run /build-openspace enable|disable to toggle
```

### Toggle Command: /build-openspace

```
/build-openspace enable    — Enable OpenSpace, check prerequisites, configure MCP
/build-openspace disable   — Disable OpenSpace, stop MCP server
/build-openspace status    — Show skill stats, evolution history
/build-openspace sync      — Sync local skills with cloud (if API key set)
/build-openspace search    — Search community skills for current project needs
```

---

## Prerequisites Check

Before enabling, verify:

```bash
# Check Python 3.12+
python3 --version 2>/dev/null | grep -E "3\.(1[2-9]|[2-9][0-9])" || echo "PYTHON_NOT_FOUND"

# Check OpenSpace installed
python3 -c "import openspace" 2>/dev/null || echo "OPENSPACE_NOT_INSTALLED"

# Check MCP server available
which openspace-mcp 2>/dev/null || echo "MCP_NOT_AVAILABLE"
```

If prerequisites fail, show:

```
OpenSpace prerequisites not met:
  ✗ Python 3.12+ required (found: {version or none})
  ✗ openspace-engine not installed

  To install:
    pip install openspace-engine
    # or
    git clone https://github.com/HKUDS/OpenSpace.git
    cd OpenSpace && pip install -e .

  Run /build-openspace enable again after installing.
```

---

## Configuration

When enabled, store config in `state/current-project.json`:

```json
{
  "openspace": {
    "enabled": false,
    "mcp_transport": "stdio",
    "auto_capture": false,
    "auto_delegate": false,
    "cloud_enabled": false,
    "cloud_api_key": null,
    "delegation_threshold": 0.8,
    "max_skills": 100,
    "skill_dir": "openspace_skills/"
  }
}
```

### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Master switch — nothing happens if false |
| `auto_capture` | `false` | Auto-capture skills after successful tasks (prompts user first time) |
| `auto_delegate` | `false` | Auto-delegate tasks to OpenSpace when matching skill found (prompts user each time) |
| `cloud_enabled` | `false` | Enable cloud skill search/upload |
| `delegation_threshold` | `0.8` | Minimum skill match confidence to suggest delegation |
| `max_skills` | `100` | Maximum local skills before pruning |

**Key principle:** Even with `auto_capture` and `auto_delegate` enabled, BuildOS always prompts the user before:
- First-time skill capture from a new task type
- Delegating a task to OpenSpace (shows skill match + confidence)
- Uploading skills to cloud
- Importing skills from cloud

---

## Integration Points

### 1. Task Execution (/build-execute) — Skill-Assisted Mode

**Only when `openspace.enabled: true`.**

Before executing a task, check if OpenSpace has a relevant skill:

```
Searching OpenSpace skills for: "{task_title}"...
  Found: "scaffold-rest-endpoint" (confidence: 0.92, applied: 14 times)
  
  Use this skill to assist execution? (y/n/details)
    y — Inject skill into execution context (faster, fewer tokens)
    n — Execute without skill assistance
    details — Show full skill content before deciding
```

- If user says **yes**: inject skill content into the execution agent's context
- If user says **no**: execute normally, no skill involvement
- Skill is injected as **guidance**, not as a replacement for governance rules
- **BuildOS governance always overrides skill suggestions**

### 2. Post-Execution (/build-learn) — Skill Capture

**Only when `openspace.enabled: true` and `auto_capture: true` (or user approves).**

After a successful sprint, during `/build-learn`:

```
OpenSpace detected a reusable pattern from this sprint:
  
  Candidate Skill: "nextjs-auth-setup"
  Description: Set up NextAuth.js with Google OAuth, session management, and middleware
  Based on: Tasks T-003, T-004, T-005
  Confidence: 0.85
  
  Capture as OpenSpace skill? (y/n/edit)
    y — Save as skill (local only, not uploaded to cloud)
    n — Skip, don't capture
    edit — Review and modify before saving
```

Captured skills:
- Are stored locally in `openspace_skills/` directory
- Follow OpenSpace's `SKILL.md` format (YAML frontmatter + markdown body)
- Include BuildOS trust metadata (source: sprint_review, trust: medium)
- Are NOT uploaded to cloud unless user explicitly runs `/build-openspace sync`

### 3. Skill Health Monitoring

**Only when `openspace.enabled: true`.**

During `/build-status`, show skill health:

```
OpenSpace Skills:
  Local: 12 skills (8 healthy, 3 degraded, 1 broken)
  Cloud: disabled
  
  Degraded skills (success rate dropped):
    - "docker-compose-setup" — 60% success (was 95%)
    - "jest-config-scaffold" — 45% success (was 90%)
    
  Fix degraded skills? (y/n)
```

If user approves, trigger OpenSpace's FIX evolution to auto-repair degraded skills.

### 4. Cloud Community

**Only when `openspace.enabled: true` and `cloud_enabled: true`.**

Never enabled by default. User must:
1. Set an API key: `/build-openspace cloud-setup`
2. Explicitly search: `/build-openspace search "CI pipeline for Node.js"`
3. Explicitly upload: `/build-openspace sync --upload`

Cloud interactions always show what will be shared:

```
Upload 3 skills to OpenSpace Cloud?
  1. "nextjs-auth-setup" (visibility: public)
  2. "prisma-migration-flow" (visibility: public)
  3. "internal-api-client" (visibility: private)
  
  ⚠ Public skills are visible to all OpenSpace users.
  ⚠ Skills are scanned for secrets/credentials before upload.
  
  Proceed? (y/n/change-visibility)
```

---

## MCP Server Configuration

When enabled, OpenSpace runs as an MCP server connected via stdio:

```json
{
  "mcpServers": {
    "openspace": {
      "command": "openspace-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "OPENSPACE_SKILL_DIR": "{project_root}/openspace_skills",
        "OPENSPACE_MODEL": "claude-sonnet-4-6"
      }
    }
  }
}
```

Available MCP tools (only accessible when enabled):
- `execute_task` — delegate a task with skill injection
- `search_skills` — find matching skills locally or in cloud
- `fix_skill` — repair a broken/degraded skill
- `upload_skill` — share a skill to cloud

**BuildOS agents access these tools only through the delegation governance layer, never directly.**

---

## Governance Guardrails

### BuildOS Authority Is Absolute

- OpenSpace skills are treated as **suggestions**, not rules
- If a skill conflicts with BuildOS governance (SOLID, security, architecture), governance wins
- Skills that repeatedly violate governance are flagged and demoted
- No skill can bypass the review pipeline (`/build-review`)

### Delegation Rules

- Tasks are NEVER auto-delegated without user confirmation
- Security-sensitive tasks (auth, crypto, PII handling) are NEVER delegated
- Tier 3 tasks (complex, multi-file) require explicit approval even with high skill match
- Delegation history is logged in `state/sprint-state.json` for audit

### Skill Trust Bridge

OpenSpace skills inherit BuildOS trust levels:

| OpenSpace Origin | BuildOS Trust | TTL | Approval |
|-----------------|---------------|-----|----------|
| Captured from sprint | medium | 90 days | Inline approval during /build-learn |
| Imported from cloud | low | 30 days | Explicit user approval |
| Auto-fixed by evolution | inherits parent | inherits | User notified, can revert |
| User-created | high | evergreen | No gate needed |

---

## Disabling OpenSpace

At any time:

```
/build-openspace disable
```

This:
- Sets `openspace.enabled: false`
- Stops the MCP server
- Preserves all captured skills locally (does not delete)
- BuildOS continues operating exactly as before
- Skills can be re-enabled later without loss

---

## Summary

| Aspect | Policy |
|--------|--------|
| Default state | **Disabled** |
| Enable mechanism | User explicitly enables via prompt or command |
| Task delegation | **Always prompts user** before delegating |
| Skill capture | **Always prompts user** before saving |
| Cloud features | **Disabled by default**, requires API key + explicit enable |
| Governance override | **BuildOS always wins** over OpenSpace suggestions |
| Security tasks | **Never delegated** to OpenSpace |
| Disable | One command, zero data loss, instant |
