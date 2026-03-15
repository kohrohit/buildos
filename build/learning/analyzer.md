---
description: "Format-agnostic log analysis instructions for pattern extraction"
---

# Log Analyzer

## Purpose
Analyze log data from any source and format to extract candidate patterns for the learning governance system.

## Input Handling
The analyzer accepts any format: JSON, plain text, CSV, metrics dumps, stack traces, API responses, structured or unstructured. No programmatic parser — the LLM agent interprets the content semantically.

## Extraction Categories
Extract patterns across all categories:
- **operational** — runtime behavior, throughput, resource usage baselines
- **failure** — error signatures, root cause correlations, timeout patterns
- **architecture** — service dependencies, data flow observations, coupling signals
- **performance** — latency baselines, degradation thresholds, capacity limits
- **process** — workflow patterns, bottleneck indicators, deployment observations

## Extraction Rules
1. Each candidate pattern MUST include a `why` — the evidence from the logs that supports it
2. Set `source_reference` to the file path or API endpoint analyzed
3. Deduplicate: compare each candidate semantically against existing patterns in `learned-patterns.json`. If >80% overlap, reinforce the existing pattern instead of creating a new candidate
4. Assign `category` based on the nature of the observation
5. Do not extract patterns from insufficient evidence (single log line with no context)
6. Do not include secrets, tokens, passwords, or PII in pattern descriptions
7. Prefer specific, actionable observations over vague generalizations

## Output
Write candidates to `staging-patterns.json` via `PatternManager.addStaged()`. Report count to user with instruction to run `/build-audit` for review.
