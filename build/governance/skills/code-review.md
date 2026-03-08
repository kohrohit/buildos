# Code Review Best Practices

Operational knowledge for conducting effective, constructive code reviews.

## Purpose of Code Review

Code review serves four goals, in order of priority:
1. **Correctness**: Does the code do what it claims to do?
2. **Security**: Does the code introduce vulnerabilities?
3. **Maintainability**: Can future developers understand and modify this code?
4. **Knowledge sharing**: Does the team learn from each other's work?

## What to Look For

### Correctness
- Does the logic handle all specified acceptance criteria?
- Are edge cases handled (empty inputs, null values, boundary conditions)?
- Are error paths handled and tested?
- Does the code behave correctly under concurrent access?
- Are state transitions valid and complete?
- Do mathematical operations handle overflow, precision, and rounding?

### Design
- Does the code follow single responsibility principle?
- Are abstractions at the right level (not too high, not too low)?
- Is the dependency direction correct (no circular dependencies)?
- Are interfaces narrow and focused?
- Is the code open for extension but closed for modification?
- Does the naming clearly communicate intent?

### Security
- Is user input validated and sanitized?
- Are SQL queries parameterized?
- Are secrets handled properly (not hardcoded, not logged)?
- Are authorization checks present on all protected operations?
- Is sensitive data encrypted in transit and at rest?

### Testing
- Are tests present for new functionality?
- Do tests cover happy path, edge cases, and error scenarios?
- Are assertions meaningful (not just "no exception thrown")?
- Are tests independent and deterministic?
- Is test code clean and maintainable (DRY, readable)?

### Performance
- Are there potential N+1 query problems?
- Is pagination implemented for list operations?
- Are expensive operations cached where appropriate?
- Are database queries using appropriate indexes?
- Are there unnecessary memory allocations or copies?

### Readability
- Can you understand the code without asking the author?
- Are variable and function names self-explanatory?
- Are complex algorithms documented with comments explaining WHY?
- Is the code organized in a logical reading order?
- Are magic numbers replaced with named constants?

## How to Give Feedback

### Tone and Approach
- Comment on the code, not the person ("This function does X" not "You did X wrong")
- Ask questions instead of making demands ("Have you considered X?" not "Do X instead")
- Explain the reasoning behind suggestions (teach, do not just correct)
- Acknowledge good work explicitly ("Nice use of the strategy pattern here")
- Distinguish between personal preference and objective improvement

### Severity Levels
- **must-fix**: Bugs, security issues, broken contracts. Label clearly: `[must-fix]`
- **should-fix**: Anti-patterns, missing tests, poor naming. Label: `[should-fix]`
- **nit**: Style preferences, minor improvements. Label: `[nit]`
- **question**: Seeking understanding, not requesting change. Label: `[question]`
- **praise**: Highlighting good work. Label: `[praise]`

### Commenting Format
```
[severity] Brief description

Detailed explanation of the concern and why it matters.

Suggested fix (if applicable):
  <code example>
```

### Example Comments

**Good:**
```
[should-fix] This function has multiple responsibilities

`processOrder` handles validation, pricing, inventory check, and notification.
Consider extracting each into its own method for testability:

  validateOrder(order)
  calculatePrice(order)
  reserveInventory(order)
  notifyCustomer(order)
```

**Bad:**
```
This is wrong. Refactor it.
```

## Review Process

### Before Reviewing
1. Read the PR description and linked issue/ticket
2. Understand the goal: what problem does this solve?
3. Check if the PR is the right size (< 400 lines of meaningful changes)
4. If the PR is too large, ask the author to split it

### During Review
1. Start with the high-level structure (new files, deleted files, moved code)
2. Read the test files first to understand intended behavior
3. Review the implementation with the tests as a guide
4. Check configuration and infrastructure changes last
5. Run the code mentally or locally for complex logic

### After Review
- Summarize your overall assessment at the top of the review
- Clearly state your verdict: approve, request changes, or comment
- If requesting changes, be specific about what needs to change
- Respond to the author's comments and mark threads as resolved

## Anti-Patterns in Code Review

### Reviewer Anti-Patterns
- **Rubber stamping**: Approving without reading (defeats the purpose)
- **Gatekeeping**: Blocking for stylistic preferences that are not team standards
- **Bike-shedding**: Spending 30 minutes debating variable names, ignoring logic bugs
- **Delayed review**: Leaving PRs unreviewed for days (blocks the author)
- **Rewrite requests**: Suggesting a completely different approach after implementation

### Author Anti-Patterns
- **Mega PRs**: Submitting 1000+ line changes (split into focused PRs)
- **No description**: Submitting a PR with no context about what or why
- **No tests**: Submitting code without corresponding tests
- **Defensive responses**: Arguing every suggestion instead of considering feedback
- **Drive-by fixes**: Including unrelated changes in the PR

## Metrics

- **Review turnaround time**: Target < 4 hours during business hours
- **PR size**: Target < 400 lines of meaningful changes
- **Review thoroughness**: At least one substantive comment per 100 lines
- **Rework rate**: Track how often PRs need multiple review cycles
- **Time to merge**: From PR creation to merge, target < 24 hours for standard PRs
