# Learn Hook

Executes after significant events to extract patterns, update knowledge, and improve future decisions.

## Context Loading

- Load the completed task briefing and results
- Load previous learnings and patterns (if a learnings log exists)
- Load relevant governance rules to check for gaps
- Load recent ADRs to identify decision patterns

## Checks

### Pattern Extraction
- [ ] Were any new patterns discovered during this task?
- [ ] Did any existing governance rules prove insufficient?
- [ ] Were there repeated questions or lookups that suggest missing documentation?
- [ ] Did any anti-patterns slip through that should be codified as rules?
- [ ] Were there tool or workflow improvements discovered?

### Rule Gaps
- [ ] Did the task reveal a scenario not covered by current rules?
- [ ] Were any rules ambiguous and required interpretation?
- [ ] Are there new anti-patterns to document based on mistakes made?
- [ ] Should any existing rules be updated with new examples?

### Process Improvements
- [ ] Was the task estimation accurate? If not, what was learned?
- [ ] Were the right agents involved? Were any missing?
- [ ] Did the hooks provide the right checks? Any gaps?
- [ ] Were there unnecessary friction points in the workflow?

### Knowledge Capture
- [ ] Document any reusable code patterns that emerged
- [ ] Record any integration gotchas or environment quirks
- [ ] Note any performance insights (queries, caching, algorithms)
- [ ] Capture any debugging techniques that were effective

## State Updates

- Append new patterns to a learnings log with date and context
- Propose updates to governance rules if gaps were identified
- Update skill documents if new operational knowledge was gained
- Record estimation calibration data (estimated vs actual effort)

## Summary Refresh

- Generate a learning summary: what was learned, what rules need updating, what patterns to reuse
- Classify learnings by category: architecture, code quality, security, performance, process
- Prioritize rule updates by impact (how many future tasks will benefit)
- Present proposed governance updates for human review before applying
