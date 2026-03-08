# Post-Merge Hook

Executes after a merge to main to verify integration health and update project context.

## Context Loading

- Load current architecture from `governance/brain/architecture.md`
- Load NFRs from `governance/brain/non-functional-requirements.md`
- Identify all files changed in the merge
- Load relevant governance rules for the affected modules

## Checks

### Integration Health
- [ ] Full test suite passes on the merged result
- [ ] No new linting errors or warnings introduced
- [ ] Build completes successfully with no compilation errors
- [ ] Database migrations run cleanly in order
- [ ] No dependency conflicts or version mismatches

### Architecture Conformance
- [ ] No new circular dependencies introduced
- [ ] Module boundaries remain intact (no unauthorized cross-module imports)
- [ ] API contracts are backward compatible or properly versioned
- [ ] No architectural drift from declared patterns

### Documentation Sync
- [ ] API documentation reflects any endpoint changes
- [ ] Architecture docs reflect any structural changes
- [ ] Changelog is updated for user-facing changes
- [ ] ADRs created for significant technical decisions in the merge

### Deployment Readiness
- [ ] Environment variables documented for any new configuration
- [ ] Migration scripts are idempotent and reversible
- [ ] Feature flags configured for gradual rollout if needed
- [ ] Monitoring and alerting updated for new endpoints or services

## State Updates

- Update project architecture summary if structural changes detected
- Record merge metadata (PR number, author, files changed, date)
- Update domain model if new entities or relationships introduced
- Refresh glossary if new domain terms appeared

## Summary Refresh

- Generate a merge impact report: what changed, what tests passed, any risks
- List new API endpoints, database tables, or services introduced
- Flag any follow-up items: documentation gaps, missing tests, tech debt
- Notify relevant agents if their domain was affected (security for auth changes, architect for structural changes)
