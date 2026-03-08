# Pre-Commit Hook

Executes before a git commit to enforce quality standards and prevent bad commits.

## Context Loading

- Load `governance/rules/global.md` for universal commit standards
- Load language-specific rules for the files being committed
- Load security baseline from `governance/skills/security-baseline.md`

## Checks

### Code Quality
- [ ] All staged files pass linting (language-appropriate linter)
- [ ] No type errors (TypeScript `tsc --noEmit`, Python `mypy`, Java compilation)
- [ ] Code formatting is consistent (Prettier, Black, google-java-format)
- [ ] No files exceed complexity thresholds
- [ ] No console.log, print(), System.out.println() debug statements in production code

### Security Scan
- [ ] No secrets, API keys, or credentials in staged files
- [ ] No `.env` files or credential files staged
- [ ] No private keys or certificates staged
- [ ] No hardcoded passwords or tokens in code
- [ ] File permissions are appropriate (no world-writable files)

### Test Verification
- [ ] All tests pass for modified modules
- [ ] Test coverage has not decreased for modified files
- [ ] No test files contain `.only` or `.skip` that would limit test execution

### Commit Message Validation
- [ ] Commit message follows conventional format: `type(scope): description`
- [ ] Types: feat, fix, docs, style, refactor, test, chore, perf, ci
- [ ] Description is present and meaningful (not "fix" or "update")
- [ ] Body explains WHY, not just WHAT (for non-trivial changes)
- [ ] References issue or ticket number where applicable

### File Hygiene
- [ ] No generated files staged (build output, compiled assets)
- [ ] No large binary files staged without LFS
- [ ] No merge conflict markers remaining in files
- [ ] .gitignore is up to date for the project

## State Updates

- Record commit metadata (hash, message, files, author)
- Update commit counter for session tracking
- Log any checks that were bypassed and why

## Summary Refresh

- Display a pre-commit summary: number of files, tests status, security scan result
- If any check fails, display clear instructions for remediation
- Block the commit if any critical check fails
