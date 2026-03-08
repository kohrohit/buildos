# Sprint Planning

Operational knowledge for slicing work, estimating effort, and defining acceptance criteria.

## Work Slicing Principles

### Vertical Slicing
- Every story delivers a thin slice of user-visible functionality
- A slice includes all layers: API, business logic, data, and tests
- Avoid horizontal slices like "build the database layer" or "create the API endpoints"
- Each slice is independently deployable and demonstrable

### INVEST Criteria
- **Independent**: Minimal dependencies on other stories
- **Negotiable**: Details can be discussed; it is not a rigid contract
- **Valuable**: Delivers value to the user or stakeholder
- **Estimable**: Team can estimate the effort with reasonable confidence
- **Small**: Completable within a single sprint (ideally 1-3 days)
- **Testable**: Clear criteria to verify completion

### Splitting Techniques
- **By workflow step**: Split a multi-step process into one story per step
- **By data variation**: Handle one data type first, then add others
- **By operation**: Create before update, update before delete
- **By interface**: API first, then UI
- **By business rule**: Implement the simple rule first, then edge cases
- **By performance**: Make it work first, then make it fast
- **By platform**: Web first, then mobile

## Estimation Guidelines

### Relative Sizing (Story Points)
- Use Fibonacci sequence: 1, 2, 3, 5, 8, 13
- A "1" is the smallest meaningful unit of work the team does
- Anything above 8 should be split into smaller stories
- 13 is a red flag: the story is too large or too uncertain
- Points measure complexity + effort + uncertainty, not hours

### Reference Stories
- Establish 3-5 reference stories at known point values
- New stories are estimated relative to these references
- Re-calibrate references each quarter as team velocity changes

### Estimation Process
1. Read the story aloud including acceptance criteria
2. Ask clarifying questions (timebox to 5 minutes)
3. Estimate simultaneously (planning poker or async)
4. Discuss outliers (highest and lowest estimates explain reasoning)
5. Converge on a value or split the story if consensus is impossible

### Uncertainty Markers
- If the team cannot agree, the story needs more refinement
- If research is needed, create a spike with a timebox
- Spikes produce knowledge and refined stories, not production code

## Defining Acceptance Criteria

### Format: Given-When-Then
```
Given [precondition or context]
When [action or event]
Then [expected outcome]
```

### Rules for Good Acceptance Criteria
- Each criterion is independently testable
- Use concrete values, not vague terms ("within 200ms" not "fast")
- Cover the happy path, important edge cases, and primary error cases
- Include non-functional requirements where relevant (performance, accessibility)
- Write from the user's perspective, not the developer's

### Example
```
Story: As a user, I can reset my password via email

AC1: Given a registered user
     When they request a password reset with their email
     Then they receive a reset link within 2 minutes

AC2: Given a reset link
     When the user clicks it within 24 hours
     Then they can set a new password (min 8 chars, 1 uppercase, 1 number)

AC3: Given a reset link
     When the user clicks it after 24 hours
     Then they see an error message and must request a new link

AC4: Given an unregistered email
     When a password reset is requested
     Then the same success message is shown (prevent email enumeration)
```

## Sprint Cadence

### Sprint Planning (2 hours for 2-week sprint)
1. Review sprint goal and capacity (15 min)
2. Pull stories from prioritized backlog (30 min)
3. Discuss and refine acceptance criteria (45 min)
4. Identify dependencies and risks (15 min)
5. Commit to sprint scope (15 min)

### Definition of Done
- [ ] Code complete and peer-reviewed
- [ ] All acceptance criteria verified with tests
- [ ] No regressions in existing test suite
- [ ] Documentation updated (API docs, README if needed)
- [ ] Security review completed for sensitive changes
- [ ] Deployed to staging and smoke tested
- [ ] Product owner accepts the demo

### Velocity Tracking
- Track completed points per sprint (not started, not in-progress)
- Use rolling average of last 3 sprints for capacity planning
- Do not compare velocity between teams
- Investigate sudden velocity changes (scope creep, technical debt, team changes)

## Common Planning Mistakes

- **Scope creep during sprint**: Adding stories mid-sprint without removing equivalent effort
- **Overcommitment**: Planning to capacity instead of sustainable pace (plan to 70-80%)
- **Ignoring technical debt**: Never allocating time for refactoring and cleanup
- **Vague acceptance criteria**: "It should work correctly" is not testable
- **No spike for unknowns**: Estimating complex unknowns instead of researching first
- **Hero planning**: Assuming the strongest developer will handle everything
- **Skipping the demo**: Not validating with stakeholders before marking done
