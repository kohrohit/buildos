# Workflow: Research

## Goal

Investigate a technical question, library, approach, or design decision before committing to implementation. This workflow produces a structured research report that informs planning and execution decisions, reducing risk by front-loading discovery and analysis.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Research question | Caller (plan, sprint, or execute workflow) | Yes |
| Research scope | Caller-defined boundaries | Yes |
| Architecture spec | `governance/brain/architecture.md` | No |
| Tech radar | `governance/brain/tech-radar.md` | No |
| Existing codebase | Project source | No |
| Time budget | Caller-defined constraint | No |

## Steps

### Step 1: Define Research Question

Formalize the research question into a structured investigation brief.

- State the question clearly and precisely. Avoid vague framing.
- Define the success criteria: what does a good answer look like?
- Identify the decision this research will inform (technology choice, design approach, feasibility assessment).
- Define the scope boundary: what is explicitly out of scope for this research.
- Set a time budget if one was provided (default: unbounded but favor speed).

Examples of well-formed research questions:
- "Is library X suitable for our real-time data pipeline given our latency NFR of <50ms p99?"
- "What are the trade-offs between approach A (event sourcing) and approach B (CRUD) for our order management module?"
- "Does the existing authentication module support OAuth 2.0 PKCE flow, or do we need to extend it?"

### Step 2: Search Codebase

Examine the existing project codebase for relevant prior art and context.

- Search for existing implementations of similar functionality.
- Identify existing patterns, abstractions, or utilities that relate to the question.
- Check for previous attempts or abandoned implementations (commented code, old branches).
- Review existing tests for behavioral expectations.
- Document findings: what exists, what is missing, what is relevant.

### Step 3: Search Documentation

Review project and external documentation for relevant information.

- Check project documentation (ADRs, architecture docs, READMEs).
- Review governance brain documents for relevant constraints or decisions.
- Search for existing research reports in `state/reports/`.
- Check if the question has been addressed in previous sprint retrospectives.
- Review library and framework documentation for relevant capabilities.

### Step 4: Search Web

Conduct targeted web research for external information.

- Search for official documentation of libraries or technologies under evaluation.
- Look for benchmark comparisons, known issues, and community feedback.
- Find reference implementations or case studies.
- Check for security advisories or vulnerability reports for candidate technologies.
- Review community forums and issue trackers for common pitfalls.
- Prioritize authoritative sources: official docs > well-known tech blogs > community posts.
- Note the publication date of all sources; prefer recent information.

### Step 5: Synthesize Findings

Analyze and combine all gathered information into a coherent assessment.

- Organize findings by relevance to the original research question.
- For technology evaluations, create a comparison matrix:
  - Feature completeness against requirements.
  - Performance characteristics against NFRs.
  - Community health (maintenance activity, contributor count, issue response time).
  - License compatibility.
  - Learning curve and documentation quality.
- For design decisions, present each option with:
  - Pros and cons.
  - Risk profile.
  - Implementation effort estimate.
  - Long-term maintenance implications.
- Identify any gaps where information is incomplete or uncertain.
- Form a recommendation with clear reasoning.

### Step 6: Produce Research Report

Write a structured research report documenting all findings and the recommendation.

- Structure the report with the following sections:
  - **Question**: The original research question.
  - **Summary**: One-paragraph answer.
  - **Methodology**: What was searched and analyzed.
  - **Findings**: Detailed findings organized by source and relevance.
  - **Comparison** (if applicable): Side-by-side evaluation matrix.
  - **Recommendation**: The recommended course of action with reasoning.
  - **Risks**: Known risks of the recommended approach.
  - **Open Questions**: Any remaining uncertainties.
  - **Sources**: All references with URLs and access dates.
- Write the report to `state/reports/research-{topic-slug}.md`.

### Step 7: Update Context If Needed

Determine whether the research findings should update project context.

- If the research recommends a new technology, draft an ADR proposal for governance review.
- If the research reveals a constraint not captured in architecture docs, flag it.
- If the research produces reusable reference material, note it for future context packs.
- Update `governance/brain/tech-radar.md` if the research evaluates a technology not yet on the radar.

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Research report | `state/reports/research-{topic-slug}.md` | Markdown |
| ADR proposal (if needed) | `governance/adrs/` | Markdown |
| Tech radar update (if needed) | `governance/brain/tech-radar.md` | Markdown |
| Comparison matrix (if applicable) | Embedded in research report | Markdown table |

## Checks

- The original research question is directly answered in the report summary.
- All findings cite their source (codebase location, documentation URL, or web reference).
- The recommendation includes clear reasoning, not just a conclusion.
- Risks of the recommended approach are documented.
- If a technology decision is involved, an ADR proposal is drafted.
- The report is written in a format that can be consumed by other workflows.

## Failure Handling

| Failure | Response |
|---------|----------|
| Question is too vague to research | Request clarification from the caller; provide examples of well-formed questions. |
| No relevant codebase results | Document the absence; proceed with external research. |
| Web search returns no useful results | Document the gap; recommend a proof-of-concept spike. |
| Conflicting information found | Present all sides; document the conflict; recommend validation approach. |
| Time budget exceeded | Produce an interim report with findings so far; note what remains uninvestigated. |
| Research question already answered | Reference the existing report; update only if new information exists. |

## Governance Interaction

- **Reads**: Architecture spec, tech radar, existing ADRs for context.
- **Proposes**: ADRs when research leads to technology or architectural decisions.
- **Updates**: Tech radar with newly evaluated technologies.
- **Respects**: Existing governance decisions constrain the solution space for research.

## Context Interaction

- **Context Pack**: Minimal. Research is largely self-contained and self-directed.
- **Context Size**: Small initial load; grows as codebase and documentation are searched.
- **Context Output**: Research report is a standalone artifact consumed by planning or sprint workflows.
- **Context Discipline**: Research context is discarded after the report is produced.
