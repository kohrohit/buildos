# Unit Report Template

## Purpose

Defines the schema for `unit-report.json` — the structured output that each parallel executor agent must produce. The orchestrator reads this file from each worktree after wave completion.

## Location

Each agent writes `unit-report.json` to the root of its worktree directory: `{worktree-path}/unit-report.json`

## Schema

```json
{
  "unit_id": "T-xxx",
  "status": "completed | failed | blocked",
  "files_modified": ["path/to/file.ts"],
  "files_created": ["path/to/new-file.ts"],
  "decisions": [
    {
      "description": "Human-readable description of architectural or design decision made",
      "files_affected": ["path/to/file.ts"]
    }
  ],
  "interfaces_defined": [
    {
      "name": "InterfaceName",
      "file": "path/to/types.ts",
      "exports": ["InterfaceName", "RelatedType"]
    }
  ],
  "warnings": ["Any concerns for subsequent waves"],
  "failure_reason": null
}
```

## Field Requirements

| Field | Required | Description |
|-------|----------|-------------|
| `unit_id` | Yes | Must match the task ID assigned to this unit |
| `status` | Yes | One of: `completed`, `failed`, `blocked` |
| `files_modified` | Yes | Array of file paths modified (can be empty) |
| `files_created` | Yes | Array of file paths created (can be empty) |
| `decisions` | Yes | Array of decisions made during implementation (can be empty) |
| `interfaces_defined` | Yes | Array of interfaces/types defined (can be empty) |
| `warnings` | Yes | Array of warning strings for subsequent waves (can be empty) |
| `failure_reason` | Conditional | Required if status is `failed` or `blocked`. Null if `completed`. |

## Missing Report Fallback

If the orchestrator cannot find `unit-report.json` after an agent completes, the unit is treated as:

```json
{
  "unit_id": "{assigned_id}",
  "status": "failed",
  "files_modified": [],
  "files_created": [],
  "decisions": [],
  "interfaces_defined": [],
  "warnings": [],
  "failure_reason": "agent did not produce unit-report.json"
}
```
