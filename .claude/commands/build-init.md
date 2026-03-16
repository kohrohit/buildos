---
description: "Initialize BuildOS project brain, seed governance, create starting state"
---

# /build-init — Project Initialization

## Purpose
Bootstrap a new project under BuildOS governance. Seeds the project brain with governance files, creates initial state, and prepares hooks for the development lifecycle.

This is the **first command** run on any project. It must be run before any other BuildOS command.

## Context Pack
Load: `governance/core-policies.md`, `governance/coding-rules.md`, `governance/architecture-principles.md`

## Steps

1. **Check for existing initialization**
   - Read `state/current-project.json`
   - If already initialized, warn and ask for confirmation to re-initialize

2. **Gather project metadata**
   - Ask user for: project name, description, primary language, architecture style
   - If a `package.json`, `Cargo.toml`, `go.mod`, or similar exists, infer defaults

3. **Document ingestion (optional: --docs flag)**
   If the user provides `--docs <folder>`:

   a. **Scan folder** — call `build-tools.cjs docs scan <folder>`. Show manifest:
      ```
      Found N documents in <folder>:
        readme.md (markdown)
        srs.pdf (PDF — will read directly)
        architecture.pptx (PPTX)
        api-spec.yaml (OpenAPI)
      Skipped: demo.mp4 (unsupported)
      ```

   b. **Extract and save** — call `build-tools.cjs docs populate <folder>`.
      Text-based files are extracted automatically to `governance/brain/sources/`.
      For files marked "claude-read" (PDFs, images):
      - Read each PDF using the Read tool (use `pages` parameter for >20 pages, read ALL pages)
      - Read each image using the Read tool (multimodal — describe the diagram)
      - For `.figma-url` files, call Figma MCP `get_design_context` with the URL
      - Save ALL extracted/described content to `governance/brain/sources/` using Write tool
      IMPORTANT: Do NOT truncate or summarize. Save the FULL extracted text — zero information loss.

   c. **Report** — show what was extracted:
      ```
      Document ingestion complete:
        ✓ readme.md (450 words)
        ✓ srs.pdf (12,400 words, read directly)
        ✓ architecture.pptx (3,200 words)
        ✓ api-spec.yaml (850 words, OpenAPI spec)
      ```

   d. **Read all sources** — read every file in `governance/brain/sources/` to understand the project.

   e. **Gap-based architecture discovery** — instead of asking all questions, identify what the documents already cover and only ask about GAPS:
      ```
      From your documents, I have good coverage of:
        ✓ Vision and goals (from srs.pdf)
        ✓ API contracts (from api-spec.yaml)

      Still need your input on:
        ? Architecture and tech stack
        ? Non-functional requirements
        ? Deployment strategy
      ```
      Populate brain files (vision.md, architecture.md, domain-model.md, requirements.md, api-contracts.md, ui-spec.md, nfrs.md, glossary.md) from the sources, confirming each section with the user.

   If `--docs` is NOT provided, skip this step entirely.

4. **Seed governance brain**
   - Ensure all governance files exist in `governance/`
   - Validate `core-policies.md`, `coding-rules.md`, `architecture-principles.md`
   - Record governance version hash

4. **Create initial state files**
   - Write `state/current-project.json` with project metadata
   - Write `state/roadmap.json` with empty epics array
   - Write `state/sprint-state.json` with null sprint
   - Write `state/task-state.json` with empty tasks array
   - Write `state/context-state.json` with governance files loaded
   - Write `state/learned-patterns.json` with empty patterns array

5. **Prepare hooks**
   - Validate `hooks.json` is present and well-formed
   - Confirm hook scripts in `bin/` are executable

6. **Generate initialization report**

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

## Governance Checks
- Verify all governance files are present and non-empty
- Record governance file checksums for drift detection
- Confirm architecture principles are loaded

## State Updates
- `current-project.json`: set name, description, initialized_at, governance_version
- `context-state.json`: record loaded governance files

## Output
```
BuildOS Initialized
  Project: {name}
  Governance: {version} ({n} brain files loaded)
  State: All 6 state files created
  Hooks: Active ({n} hooks registered)
  Ready for: /build-plan
```
