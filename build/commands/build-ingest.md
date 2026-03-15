---
description: "Analyze logs from any source, extract candidate patterns, stage for review"
---

# /build-ingest — Log Analysis & Pattern Extraction

## Purpose
Read log data from a file, analyze it for meaningful patterns, and stage candidates for user review. Format-agnostic — handles JSON, plain text, CSV, metrics, stack traces, or any other format.

## Context Pack
Load: `learning/analyzer.md`, `learning/staging-policy.md`
Also load: `state/learned-patterns.json`, `state/staging-patterns.json`

## Input
- File path provided by user (required)
- API integration: future extension

## Steps

1. **Read log data**
   - Read the file at the provided path
   - Do not assume any specific format — interpret content semantically

2. **Analyze for patterns**
   - Follow extraction rules in `learning/analyzer.md`
   - Extract across all categories: operational, failure, architecture, performance, process
   - Each candidate must have: description, why, category

3. **Deduplicate**
   - Compare each candidate semantically against existing patterns in `learned-patterns.json`
   - If >80% semantic overlap with an existing pattern, reinforce that pattern instead of creating new
   - Report reinforcements separately from new candidates

4. **Stage candidates**
   - Write new candidates to `staging-patterns.json` via `PatternManager.addStaged()`
   - Set `source: log_analysis`, `trust: low`, `confidence: 0.5`
   - Set `source_reference` to the file path analyzed

5. **Report**
   - Show extraction summary to user

## Governance Checks
- No secrets, credentials, or PII in extracted patterns
- Patterns must include `why` with evidence from logs
- Candidates must not contradict existing governance rules

## State Updates
- `staging-patterns.json`: new candidates added
- `learned-patterns.json`: reinforced patterns updated (if duplicates found)

## Output
```
Log Analysis Complete
  Source: {file_path}
  Patterns Extracted: {n} new, {n} reinforced
  Staged for Review: {n}
  Next: /build-audit staged
```
