---
description: "Manage OpenSpace skill evolution engine — enable, disable, search, sync, and monitor skills"
---

# /build-openspace — OpenSpace Skill Engine Management

## Purpose

Manage the optional OpenSpace integration. OpenSpace is a self-evolving skill engine that captures reusable patterns from sprint executions, auto-repairs degraded skills, and optionally shares them via a cloud community.

**This feature is opt-in. It does nothing unless the user explicitly enables it.**

## Subcommands

### /build-openspace enable

Enable OpenSpace integration for this project.

**Steps:**

1. Check prerequisites:
   ```bash
   python3 --version  # Needs 3.12+
   python3 -c "import openspace"  # Needs openspace-engine
   which openspace-mcp  # Needs MCP server binary
   ```

2. If prerequisites fail, show installation instructions and exit

3. If prerequisites pass, confirm with user:
   ```
   Enable OpenSpace for this project?
     - Skills will be stored in: openspace_skills/
     - MCP server will run via stdio
     - You will be prompted before any delegation or capture
     
     Enable? (y/n)
   ```

4. If confirmed:
   - Set `openspace.enabled: true` in `state/current-project.json`
   - Create `openspace_skills/` directory if not exists
   - Add `.gitignore` entry for `openspace_skills/.cache/`
   - Log enablement in project state

5. Output:
   ```
   OpenSpace Enabled
     Skill directory: openspace_skills/
     Auto-capture: off (enable with /build-openspace config auto_capture true)
     Auto-delegate: off (enable with /build-openspace config auto_delegate true)
     Cloud: off (enable with /build-openspace cloud-setup)
     
     OpenSpace will prompt you during /build-execute and /build-learn.
   ```

### /build-openspace disable

Disable OpenSpace integration.

**Steps:**

1. Set `openspace.enabled: false` in `state/current-project.json`
2. Stop MCP server if running
3. Preserve all skills locally (no deletion)

4. Output:
   ```
   OpenSpace Disabled
     Skills preserved in: openspace_skills/ (not deleted)
     Re-enable anytime with: /build-openspace enable
   ```

### /build-openspace status

Show current OpenSpace state.

**Steps:**

1. Check if enabled
2. If disabled:
   ```
   OpenSpace: disabled
     Enable with: /build-openspace enable
   ```

3. If enabled, read skill directory and show:
   ```
   OpenSpace: enabled
     Skills: {n} local ({healthy} healthy, {degraded} degraded, {broken} broken)
     Cloud: {enabled|disabled}
     Auto-capture: {on|off}
     Auto-delegate: {on|off}
     
     Recent activity:
       - Captured "rest-endpoint-scaffold" from SPRINT-005 (3 days ago)
       - Fixed "docker-setup" — success rate 60% → 94% (1 day ago)
       - Delegated 2 tasks in SPRINT-006 (saved ~3200 tokens)
     
     Top skills by usage:
       1. "nextjs-auth-setup" — applied 14 times, 96% success
       2. "prisma-migration" — applied 8 times, 92% success
       3. "jest-config" — applied 6 times, 88% success
   ```

### /build-openspace search [query]

Search for skills matching a query. Searches local skills first, then cloud (if enabled).

**Steps:**

1. Check OpenSpace is enabled
2. Search local skills by query
3. If cloud enabled, search cloud skills
4. Present results:
   ```
   Skill Search: "CI pipeline for Node.js"
   
   Local Results:
     1. "github-actions-node" — confidence: 0.91, applied: 5 times
     2. "jest-ci-config" — confidence: 0.78, applied: 3 times
   
   Cloud Results: (requires /build-openspace cloud-setup)
     Not enabled. Run /build-openspace cloud-setup to search community skills.
   
   Import a skill? Enter number or 'n' to skip:
   ```

### /build-openspace sync

Sync skills with OpenSpace Cloud (upload/download).

**Requires `cloud_enabled: true`.**

**Steps:**

1. Check cloud is enabled and API key is set
2. Show what will be synced:
   ```
   Sync Preview:
     Upload (new/updated local skills):
       - "nextjs-auth-setup" (public)
       - "prisma-migration" (public)
     
     Download (new cloud skills matching your project):
       - "tailwind-component-scaffold" by @username (confidence: 0.85)
     
     ⚠ Public uploads are visible to all OpenSpace users
     ⚠ All skills scanned for secrets before upload
     
     Proceed? (y/n/select)
   ```
3. Execute sync only with user confirmation

### /build-openspace config [key] [value]

Configure OpenSpace settings.

```
/build-openspace config auto_capture true     — Enable auto-capture prompts during /build-learn
/build-openspace config auto_delegate true    — Enable delegation prompts during /build-execute
/build-openspace config delegation_threshold 0.85  — Set minimum confidence for delegation suggestions
/build-openspace config max_skills 50         — Set maximum local skill count
```

### /build-openspace cloud-setup

Configure cloud features.

**Steps:**

1. Prompt for API key:
   ```
   OpenSpace Cloud Setup
     Get an API key at: https://open-space.cloud
     
     Enter API key (or 'skip' to set up later):
   ```

2. If key provided:
   - Validate key against cloud API
   - Set `cloud_enabled: true` and store key securely
   - Show cloud status

3. If skipped:
   - Keep cloud disabled
   - All features work locally without cloud

### /build-openspace fix [skill-name]

Manually trigger skill repair.

**Steps:**

1. Identify the skill to fix
2. Show current health metrics
3. Confirm with user:
   ```
   Fix skill "docker-compose-setup"?
     Current success rate: 60% (was 95%)
     Last failure: "docker compose v2 syntax change"
     
     OpenSpace will analyze failures and generate a fixed version.
     Fix? (y/n)
   ```
4. If confirmed, trigger OpenSpace FIX evolution
5. Show diff between old and new skill content
6. Ask user to approve the fix before applying

## Governance Checks

- OpenSpace commands are only available when `openspace.enabled: true` (except `enable` and `status`)
- All skill modifications require user confirmation
- Cloud uploads are scanned for secrets/credentials
- Security-sensitive skills cannot be uploaded to cloud as public
- BuildOS governance rules always override skill content

## State Updates

- `current-project.json`: update `openspace.*` configuration
- `sprint-state.json`: log delegation events (which task, which skill, outcome)
- Skills stored in `openspace_skills/` directory (outside BuildOS state)

## Output Format

All subcommands follow consistent format:
```
OpenSpace: {subcommand}
  {result details}
  
  Next: {suggested next action}
```
