# Post-Task Hook

Executes after a task is completed to verify quality, update context, and capture learnings.

## Context Loading

- Reload the task briefing from pre-task hook
- Load acceptance criteria defined at task start
- Load relevant governance rules that apply to the changes made

## Checks

### Completeness Verification
- [ ] All acceptance criteria are met
- [ ] No TODO or FIXME comments left without tracking issues
- [ ] All new files follow project naming conventions
- [ ] No temporary or debug code remains

### Quality Gate
- [ ] Code compiles and builds without errors or warnings
- [ ] All existing tests pass
- [ ] New tests written for new functionality
- [ ] Test coverage meets project thresholds
- [ ] Linter passes with zero errors and zero warnings
- [ ] No new security warnings from static analysis

### Documentation Check
- [ ] Public APIs have documentation (JSDoc, docstrings, OpenAPI)
- [ ] Architecture docs updated if structural changes were made
- [ ] ADR created if a significant technical decision was made
- [ ] README updated if setup or usage instructions changed

### Dependency Check
- [ ] No unnecessary new dependencies added
- [ ] New dependencies are justified and vetted
- [ ] No known vulnerabilities in new dependencies
- [ ] Lock file updated and committed

## State Updates

- Record task completion time and duration
- Update task status to completed
- Log summary of files created, modified, and deleted
- Record any deferred work or follow-up items

## Summary Refresh

- Generate a completion summary: what was done, what changed, what was tested, any follow-ups needed
- List all files modified with a one-line description of each change
- Note any deviations from the original plan and why
- Flag any technical debt introduced and proposed remediation timeline
