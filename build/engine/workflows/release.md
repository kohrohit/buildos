# Workflow: Release

## Goal

Prepare, validate, and finalize a release by running the full verification cycle, confirming all deliverables, applying release metadata, and compressing sprint history into a persistent summary. This workflow is the final gate before work is considered done and archived.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Sprint specification | `state/sprints/{sprint-id}.md` | Yes |
| Sprint state | `state/sprint-state.json` | Yes |
| Verification report | `state/reports/{sprint-id}-verification.md` | Yes |
| All sprint deliverables | Project source files | Yes |
| Governance rules | `governance/rules/` | Yes |
| Architecture spec | `governance/brain/architecture.md` | Yes |
| NFR requirements | `governance/brain/nfrs.md` | Yes |
| Previous releases | `state/releases/` | No |
| Changelog | `CHANGELOG.md` | No |
| Project summary | `governance/brain/project-summary.md` | No |

## Steps

### Step 1: Run Full Verification

Execute the complete verify workflow if it has not been run or if code has changed since the last verification.

- Check `state/sprint-state.json` for the verification status of the current sprint.
- If the sprint status is `verification-ready` or `approved-with-reservations`, proceed.
- If the sprint has not been verified, invoke the verify workflow first.
- If the sprint was `rejected`, abort the release — execution must address findings first.
- Re-run verification if any code has been modified since the last verification report.
- The release cannot proceed unless verification status is `approved` or `approved-with-reservations`.

### Step 2: Check All Sprint Deliverables

Confirm that every deliverable listed in the sprint specification exists and is complete.

- Walk the sprint specification's deliverables list.
- For each deliverable, verify:
  - The artifact exists at its expected location.
  - The artifact is non-empty and appears complete.
  - The artifact was covered by the verification report.
- Check that all tasks in `state/sprint-state.json` have status `complete`.
- Flag any missing or incomplete deliverables as release blockers.
- Verify that no work-in-progress files or temporary artifacts remain in the codebase.

### Step 3: Run Security Scan

Perform a final security sweep independent of the verification workflow's security review.

- Scan all project dependencies for known vulnerabilities.
- Check for newly disclosed CVEs since the last verification.
- Scan for accidentally committed secrets, credentials, or API keys.
- Verify that all environment-specific configuration uses environment variables, not hardcoded values.
- Verify that file permissions are appropriate (no world-writable sensitive files).
- If any critical or high-severity vulnerability is found, block the release.
- Document all findings in the release notes, including accepted low-severity items.

### Step 4: Update Changelog

Create or update the project changelog with this release's changes.

- Follow the Keep a Changelog format (https://keepachangelog.com/).
- Categorize changes under: Added, Changed, Deprecated, Removed, Fixed, Security.
- Derive entries from completed tasks and their descriptions.
- Include the release version number and date.
- Reference related epic and sprint IDs for traceability.
- If `CHANGELOG.md` does not exist, create it with the standard header.

### Step 5: Tag Version

Apply version metadata to the release.

- Determine the version number using semantic versioning:
  - **Major**: Breaking changes to public APIs or data models.
  - **Minor**: New features without breaking changes.
  - **Patch**: Bug fixes and non-functional improvements.
- Create a git tag with the version number (if git is in use).
- Write release metadata to `state/releases/{version}.json`:
  - Version number.
  - Release date.
  - Sprint ID.
  - Epic ID.
  - Deliverable manifest.
  - Verification report reference.
  - Changelog excerpt.

### Step 6: Update Project Summary

Refresh the project summary to reflect the new state of the system.

- Update `governance/brain/project-summary.md` with:
  - New modules or components added.
  - Modified architectural boundaries.
  - Updated technology inventory.
  - Current system capabilities.
  - Known limitations or technical debt.
- Ensure the project summary accurately represents the system after this release.
- This summary becomes the authoritative snapshot for future planning workflows.

### Step 7: Compress Sprint into Summary

Archive the sprint's detailed state into a compact summary for long-term retention.

- Create `state/sprint-history/{sprint-id}-summary.md` containing:
  - Sprint goal and outcome (met/partially met/not met).
  - Key decisions made during execution.
  - Lessons learned and process observations.
  - Metrics: task count, completion rate, coverage achieved, issues found.
  - Files created and modified (manifest).
  - Links to the verification report and release metadata.
- After the summary is written, the detailed sprint state can be archived:
  - Move task specifications to `state/archive/tasks/`.
  - Clear the sprint from `state/sprint-state.json` active slot.
  - Retain the sprint specification in `state/sprints/` for reference.
- The compressed summary preserves institutional knowledge without consuming active context.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Release metadata | `state/releases/{version}.json` | JSON |
| Updated changelog | `CHANGELOG.md` | Markdown |
| Updated project summary | `governance/brain/project-summary.md` | Markdown |
| Sprint history summary | `state/sprint-history/{sprint-id}-summary.md` | Markdown |
| Security scan results | Embedded in release metadata | JSON |
| Git tag (if applicable) | Git repository | Tag |

## Checks

- Verification report exists and shows `approved` or `approved-with-reservations`.
- All sprint deliverables are present and complete.
- Security scan passes with no critical or high-severity findings.
- Changelog is updated with all changes from this release.
- Version number follows semantic versioning correctly.
- Project summary accurately reflects the post-release system state.
- Sprint history summary captures key decisions and lessons.
- No work-in-progress or temporary artifacts remain in the codebase.
- Release metadata is complete and written to state.

## Failure Handling

| Failure | Response |
|---------|----------|
| Verification not passed | Block release; return to execute workflow to address findings. |
| Missing deliverable | Block release; create a task to produce the missing deliverable. |
| Critical security vulnerability | Block release immediately; create a security fix task with P0 priority. |
| High-severity vulnerability | Block release; assess whether a fix or documented exception is appropriate. |
| Changelog generation fails | Create changelog manually from task descriptions; document the tooling issue. |
| Version conflict | Resolve by incrementing to the next available version; document the conflict. |
| Project summary update fails | Log the failure; release can proceed but flag for immediate follow-up. |
| Sprint compression fails | Log the failure; retain full sprint state until compression succeeds. |

## Governance Interaction

- **Uses Agents**: Full review cycle — `code-reviewer`, `security-reviewer`, `qa-verifier`.
- **Reads**: Complete governance brain, all rules, architecture spec, NFRs.
- **Updates**: Project summary in the governance brain to reflect the release.
- **Validates**: Final security scan independent of verification workflow.
- **Archives**: Sprint findings and lessons learned for governance process improvement.

## Context Interaction

- **Context Pack**: `release` — loads full governance context plus current sprint state.
- **Context Size**: Large. Release requires broad awareness of governance, sprint, and project state.
- **Context Output**: Release metadata and compressed sprint summary for long-term retention.
- **Context Cleanup**: After release, active sprint context is cleared; only summaries persist.
- **Context Compression**: Sprint details are compressed into summaries to free context budget.
