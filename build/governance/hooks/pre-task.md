# Pre-Task Hook

Executes before any task begins to ensure the agent has full context and the task is well-defined.

## Context Loading

### Project Context
- Load `governance/brain/vision.md` to understand product direction
- Load `governance/brain/architecture.md` to understand current system design
- Load `governance/brain/domain-model.md` to understand domain concepts
- Load `governance/brain/glossary.md` to use consistent terminology
- Load `governance/brain/non-functional-requirements.md` to respect constraints

### Relevant Rules
- Load `governance/rules/global.md` for universal standards
- Load language-specific rules based on the project's tech stack
- Identify which agent(s) are relevant for this task type

### Recent Context
- Check recent ADRs in `governance/brain/adr/` for recent architectural decisions
- Review recent git history for related changes (last 10 commits)
- Check for any in-progress work that may conflict

## Checks

### Task Definition Validation
- [ ] Task has clear acceptance criteria or a well-defined goal
- [ ] Task scope is bounded (not open-ended)
- [ ] Required inputs are available (files, APIs, credentials)
- [ ] Task does not conflict with in-progress work on other branches
- [ ] Task aligns with the project vision and current priorities

### Environment Validation
- [ ] Required tools and dependencies are available
- [ ] Working directory is clean (no uncommitted changes that block work)
- [ ] Target branch is up to date with main
- [ ] Required services are accessible (database, APIs)

### Risk Assessment
- [ ] Identify files and modules that will be affected
- [ ] Estimate blast radius of the change
- [ ] Determine if security-reviewer involvement is needed
- [ ] Determine if architect involvement is needed for structural changes

## State Updates

- Record task start time and initial context
- Create a task summary noting: goal, affected modules, risk level
- Set the active agent(s) for this task
- Log which governance rules and brain documents were loaded

## Summary Refresh

- Generate a one-paragraph task briefing summarizing: what will be done, why, which modules are affected, which standards apply, and what risks were identified
- Present the briefing before beginning implementation
