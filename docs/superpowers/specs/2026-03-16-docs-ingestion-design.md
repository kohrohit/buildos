# Document Ingestion: /build-init --docs Enhancement

**Date:** 2026-03-16
**Version:** v0.5.0 feature
**Status:** Draft

## Overview

Adds an optional `--docs <folder>` flag to `/build-init` that extracts full text from project literature (SRS, architecture docs, presentations, diagrams, API specs, wireframes) and saves them as source files. Claude then reads these sources during architecture discovery to populate the brain intelligently — no lossy keyword classification, no information loss.

### Problems Solved

- **Manual context transfer:** Users must describe their project through Q&A even when comprehensive documentation exists.
- **Information loss:** Documents contain nuance, cross-references, and implicit decisions that get lost in conversation.
- **Redundant questions:** Architecture discovery asks about things already documented.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Classification | None — Claude reads sources during Q&A | Keyword-based classification is lossy. Claude understands context, nuance, cross-references. |
| Storage | Full text in `governance/brain/sources/` | Zero information loss. Sources persist for future reference. |
| Brain population | Claude populates during architecture discovery, user confirms | Human-in-the-loop prevents misclassification. |
| Activation | Optional `--docs` flag | Fully backward compatible. No flag = today's behavior. |
| Large documents | No truncation of extracted text | Full text saved to sources. Claude processes as much as context allows. |
| Processing | Per-file, independent | One file failing doesn't block others. |

---

## 1. DocumentProcessor Manager

New manager in `build-tools.cjs` after SecurityScanner, before Hooks. Three methods only — scan, extract, save.

### Methods

| Method | Purpose |
|--------|---------|
| `scanFolder(folderPath)` | Recursively find all supported files, return manifest with file paths, types, sizes |
| `extractText(filePath)` | Extract text from file. Returns `{text, type: "extracted"}` for text-based formats (MD, TXT, YAML, PUML, DOCX, PPTX). Returns `{path, type: "claude-read"}` for PDFs and images — signals that Claude must read these directly using its Read tool. |
| `saveSource(fileName, text)` | Write extracted text to `governance/brain/sources/{relativePath.replace(/\//g, '--')}.md` — uses `--` separator to flatten subdirectory paths and avoid duplicate filename collisions (e.g., `sub1/readme.md` → `sub1--readme.md.md`) |

### Supported File Types

| Type | Extensions | Extraction Method |
|------|-----------|-------------------|
| PDF | `.pdf` | Claude's Read tool (handles PDFs natively). For >20 pages, extract in 20-page chunks via multiple reads. |
| Word | `.docx` | `unzip -p file.docx word/document.xml`, strip XML tags, preserve heading structure |
| PowerPoint | `.pptx` | `unzip -p file.pptx ppt/slides/slide*.xml` + `ppt/notesSlides/*`, strip XML, preserve slide order |
| OpenAPI | `.yaml`, `.yml`, `.json` | Direct text read. Detected by `openapi:` or `swagger:` key. |
| PlantUML | `.puml`, `.plantuml` | Direct text read |
| Mermaid | `.mmd`, `.mermaid` | Direct text read |
| Markdown | `.md` | Direct text read |
| Images | `.png`, `.jpg`, `.jpeg`, `.svg` | Claude's multimodal Read tool — produces text description of diagram content |
| Plain text | `.txt`, `.rst` | Direct text read |
| Figma | `.figma-url` | File contains a Figma URL. Calls Figma MCP `get_design_context`. If MCP unavailable, skip with warning. |

**Unsupported types** (`.mp4`, `.zip`, `.exe`, etc.) are skipped with a warning in the manifest.

### DOCX/PPTX XML Extraction

Both formats are ZIP archives containing XML:

```javascript
// DOCX: extract document body
const xml = _execSyncRaw(`unzip -p "${filePath}" word/document.xml`, { encoding: 'utf-8' });
// Strip XML tags, preserve paragraph breaks
const text = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').trim();

// PPTX: list slides, extract each
const slideList = _execSyncRaw(`unzip -l "${filePath}" | grep "ppt/slides/slide" | awk '{print $4}'`);
// For each slide: extract XML, strip tags
// Also extract speaker notes from ppt/notesSlides/notesSlideN.xml
```

No npm dependencies. `unzip` is available on all Linux/macOS systems. On systems without `unzip`, the file is skipped with a warning.

### Execution Context Split

DocumentProcessor in `build-tools.cjs` (Node.js) handles text-based formats directly:
- **Node.js extracts:** MD, TXT, RST, YAML, JSON, PUML, MMD, DOCX (unzip), PPTX (unzip)
- **Claude extracts:** PDF (Read tool with pages param), Images (multimodal Read tool), Figma (MCP)

For Claude-handled types, `extractText()` returns `{ path: filePath, type: "claude-read" }` instead of text. The `/build-init` command prompt instructs Claude to read these files directly using its Read tool and save the extracted content to sources/. This means PDF and image extraction happens in the Claude session, not in the Node.js CLI.

### PDF Chunked Reading

For PDFs larger than 20 pages:

```
Pages 1-20  → read, append to text
Pages 21-40 → read, append to text
...
```

The Read tool's `pages` parameter handles this. Full text is preserved — no truncation, no summarization. The source file may be large but that's the point — zero information loss.

---

## 2. Integration with /build-init

### Usage

```
/build-init MyApp "A task API"                    → works as today
/build-init MyApp "A task API" --docs ./docs/     → scans folder first
```

### Modified Flow

```
/build-init MyApp "A task API" --docs ./project-docs/

Step 1: Parse args
  → name: MyApp
  → description: "A task API"
  → docs_folder: ./project-docs/

Step 2: Scan folder
  → build-tools.cjs docs scan ./project-docs/
  → Returns manifest:
    Found 6 supported files:
      srs.pdf (PDF, 2.1 MB, ~45 pages)
      architecture.pptx (PPTX, 850 KB, 12 slides)
      api-spec.yaml (OpenAPI, 15 KB)
      class-diagram.puml (PlantUML, 3 KB)
      wireframes.png (Image, 420 KB)
      readme.md (Markdown, 8 KB)
    Skipped 1 unsupported: demo-video.mp4

Step 3: Extract and save
  → For each file:
    build-tools.cjs docs extract <file>
    → Text saved to governance/brain/sources/{filename}.md
  → Report:
    ✓ srs.pdf → sources/srs.pdf.md (12,400 words)
    ✓ architecture.pptx → sources/architecture.pptx.md (3,200 words)
    ✓ api-spec.yaml → sources/api-spec.yaml.md (850 words)
    ✓ class-diagram.puml → sources/class-diagram.puml.md (200 words)
    ✓ wireframes.png → sources/wireframes.png.md (450 words, described)
    ✓ readme.md → sources/readme.md.md (600 words)

Step 4: Architecture discovery (enhanced)
  → Claude reads ALL source files from governance/brain/sources/
  → "I've read your 6 project documents. Here's what I understand:

     Vision: You're building a task management API for...
     Architecture: The system uses a 3-tier architecture with...
     Domain: Core entities are User, Task, Project, Comment...
     API: 15 REST endpoints defined in OpenAPI spec...
     UI: Wireframes show a dashboard with...

     Let me populate your project brain section by section.
     I'll confirm each with you before saving."
  → Claude populates brain files, user confirms each
  → Only asks Q&A for things NOT covered in the documents

Step 5: Security config (existing, from v0.4)
Step 6: Create state files (existing)
```

### Gap-Based Q&A

After reading sources, Claude identifies what the documents covered and what's missing:

```
From your documents, I have good coverage of:
  ✓ Vision and goals (from srs.pdf)
  ✓ Architecture and tech stack (from architecture.pptx)
  ✓ Domain model (from class-diagram.puml)
  ✓ API contracts (from api-spec.yaml)

Still need your input on:
  ? Non-functional requirements — no SLAs or performance targets found
  ? Deployment strategy — not covered in any document
  ? Glossary — should I extract terms from the SRS?
```

This makes the Q&A shorter and more focused.

---

## 3. Source File Format

Each source file in `governance/brain/sources/` follows this format:

```markdown
# Source: {original filename}

**Type:** {PDF|DOCX|PPTX|OpenAPI|PlantUML|Mermaid|Markdown|Image|Text|Figma}
**Extracted:** {timestamp}
**Size:** {word count} words
**Original:** {relative path to original file}

---

{full extracted text}
```

The header provides metadata for Claude to understand what it's reading. The text after the separator is the complete extraction.

### Source files are NOT loaded into context packs

Sources can be large (10,000+ words). They are:
- Read by Claude during `/build-init` architecture discovery (one-time)
- Available for manual reference (`Read` tool) during any phase
- NOT auto-loaded into planning, execution, or review context packs

The brain files (vision.md, architecture.md, etc.) are the structured, concise versions that context packs load. Sources are the unabridged originals.

---

## 4. CLI Subcommands

New subcommands in build-tools.cjs:

| Command | Purpose | Output |
|---------|---------|--------|
| `docs scan <folder>` | Scan folder recursively for supported files | JSON: manifest with file paths, types, sizes |
| `docs extract <file>` | Extract text from a single file | JSON: {text, wordCount, type} or {error} |
| `docs populate <folder>` | Full pipeline: scan → extract all → save sources | Report text |

### Manifest Output (docs scan)

```json
{
  "folder": "./project-docs/",
  "files": [
    { "path": "./project-docs/srs.pdf", "type": "pdf", "size_bytes": 2200000, "estimated_pages": 45 },
    { "path": "./project-docs/architecture.pptx", "type": "pptx", "size_bytes": 850000, "slides": 12 },
    { "path": "./project-docs/api-spec.yaml", "type": "openapi", "size_bytes": 15000 }
  ],
  "skipped": [
    { "path": "./project-docs/demo.mp4", "reason": "unsupported type" }
  ],
  "total_supported": 6,
  "total_skipped": 1
}
```

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| `--docs` folder doesn't exist | Error: "Folder not found: ./docs/". Init aborts. |
| Folder is empty | Warning: "No supported files found". Init continues without docs (normal Q&A). |
| Unsupported file type | Skipped with note in manifest. Other files still processed. |
| PDF >20 pages | Chunked reading in 20-page batches. Full text preserved. |
| PDF >200 pages | Warning: "Large document (N pages). Extraction may take a moment." Still processes fully. |
| DOCX/PPTX corrupted (unzip fails) | Skip with warning. Other files still processed. |
| `unzip` not installed | Skip DOCX/PPTX with warning: "unzip not available. Install: apt install unzip". |
| Figma MCP not connected | Skip .figma-url files with warning. |
| Image has no recognizable diagram | Claude's description is still saved — may be useful context even if not a diagram. |
| Re-init with --docs (brain already populated) | Sources are overwritten (re-extracted). Brain files are NOT touched — architecture discovery handles merging. |
| File read permission denied | Skip with warning. |

**No partial failure stops the pipeline.** Each file is independent. The manifest report shows what succeeded and what didn't.

---

## 6. Files Changed / Created

### Modified

| File | Change |
|------|--------|
| `build/bin/build-tools.cjs` | +DocumentProcessor manager, +docs CLI subcommands (~150 lines) |
| `build/commands/build-init.md` | +`--docs` flag handling: scan, extract, save sources, enhanced architecture discovery |
| `.claude/commands/build-init.md` | Same update (mirror) |

### New

| File | Purpose |
|------|---------|
| `governance/brain/sources/` | Directory for raw extracted source texts (created by `docs populate`) |

### New brain files (created by Claude during init, not by DocumentProcessor)

| File | Purpose |
|------|---------|
| `governance/brain/requirements.md` | Functional requirements (if found in sources) |
| `governance/brain/api-contracts.md` | API specs (if found in sources) |
| `governance/brain/ui-spec.md` | UI/UX specs (if found in sources) |

These are created by Claude during architecture discovery, NOT by the DocumentProcessor. The processor only creates source files. Claude reads sources and populates brain files with user confirmation.

### Unchanged

| File | Reason |
|------|--------|
| Ralph Loop files | Independent feature |
| Security scanning files | Independent feature |
| Existing brain files (vision.md, architecture.md, etc.) | Only modified by Claude during init, not by code |
| Context packs | Sources not loaded into packs |

### Modified state

| File | Change |
|------|--------|
| `state/current-project.json` | +`docs_ingested` field tracking folder, files processed, timestamp |
