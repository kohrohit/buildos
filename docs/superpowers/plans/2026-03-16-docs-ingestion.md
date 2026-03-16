# Document Ingestion (/build-init --docs) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `--docs <folder>` flag to `/build-init` that extracts full text from project literature into `governance/brain/sources/`, enabling Claude to read documents during architecture discovery and populate the brain intelligently.

**Architecture:** DocumentProcessor manager in build-tools.cjs handles folder scanning and text extraction for text-based formats (MD, TXT, YAML, DOCX, PPTX). PDFs and images return a `claude-read` marker so the `/build-init` command prompt instructs Claude to read them directly. Sources are saved with flattened paths (`sub1--readme.md.md`) to avoid collisions.

**Tech Stack:** Node.js (CJS), `unzip` CLI (for DOCX/PPTX), Claude Read tool (for PDF/images), Figma MCP (for .figma-url files)

**Spec:** `docs/superpowers/specs/2026-03-16-docs-ingestion-design.md`

---

## Chunk 1: DocumentProcessor Manager

### Task 1: Add DocumentProcessor with scanFolder

**Files:**
- Modify: `build/bin/build-tools.cjs` (insert after SecurityScanner, before Hooks)

- [ ] **Step 1: Add supported extensions constant**

Search for `const SEMGREP_RULESETS` and add after the security constants block:

```javascript
// ---------------------------------------------------------------------------
// Document ingestion constants
// ---------------------------------------------------------------------------

const SUPPORTED_DOC_TYPES = {
  '.pdf':       'pdf',
  '.docx':      'docx',
  '.pptx':      'pptx',
  '.yaml':      'yaml',
  '.yml':       'yaml',
  // .json files are only ingested if they contain OpenAPI/Swagger markers
  // Detection happens in extractText — scanFolder includes them tentatively
  '.json':      'json',
  '.puml':      'plantuml',
  '.plantuml':  'plantuml',
  '.mmd':       'mermaid',
  '.mermaid':   'mermaid',
  '.md':        'markdown',
  '.txt':       'text',
  '.rst':       'text',
  '.png':       'image',
  '.jpg':       'image',
  '.jpeg':      'image',
  '.svg':       'image',
  '.figma-url': 'figma',
};

const BRAIN_SOURCES_DIR = path.join(GOV_DIR, 'brain', 'sources');
```

- [ ] **Step 2: Add DocumentProcessor with scanFolder**

Search for the closing `};` of SecurityScanner. Insert after it, before the Hooks section:

```javascript
// ---------------------------------------------------------------------------
// DocumentProcessor — extract text from project literature for brain seeding
// ---------------------------------------------------------------------------

const DocumentProcessor = {
  // Own exec helpers — no dependency on SecurityScanner
  _docExec(cmd, timeout) {
    try {
      return { output: _execSyncRaw(cmd, { encoding: 'utf-8', timeout: timeout || 30000, stdio: ['pipe', 'pipe', 'pipe'] }), error: null };
    } catch (err) {
      return { output: null, error: err.message || 'unknown error' };
    }
  },

  _docExecSimple(cmd, timeout) {
    try {
      return _execSyncRaw(cmd, { encoding: 'utf-8', timeout: timeout || 30000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return null;
    }
  },

  _flattenPath(relativePath) {
    // sub1/readme.md → sub1--readme.md
    return relativePath.replace(/\//g, '--').replace(/\\/g, '--');
  },

  _sourcePath(relativePath) {
    const flatName = this._flattenPath(relativePath);
    return path.join(BRAIN_SOURCES_DIR, `${flatName}.md`);
  },

  scanFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
      return { error: `Folder not found: ${folderPath}` };
    }

    const files = [];
    const skipped = [];

    const walk = (dir, base) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name);

        // Skip symlinks to avoid circular references
        if (entry.isSymbolicLink()) {
          skipped.push({ path: relPath, reason: 'symlink skipped' });
          continue;
        }

        if (entry.isDirectory()) {
          // Skip hidden dirs and node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          walk(fullPath, relPath);
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        const type = SUPPORTED_DOC_TYPES[ext];

        if (!type) {
          skipped.push({ path: relPath, reason: 'unsupported type' });
          continue;
        }

        const stat = fs.statSync(fullPath);
        const fileInfo = {
          path: fullPath,
          relative_path: relPath,
          type,
          size_bytes: stat.size,
        };

        // Warn on very large files (>50MB)
        if (stat.size > 50 * 1024 * 1024) {
          fileInfo.warning = 'Large file (>50MB). Extraction may be slow.';
        }

        files.push(fileInfo);
      }
    };

    walk(folderPath, '');

    return {
      folder: folderPath,
      files,
      skipped,
      total_supported: files.length,
      total_skipped: skipped.length,
    };
  },
```

- [ ] **Step 3: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: Will fail because DocumentProcessor is not closed. Temporarily add `};` after scanFolder, verify, then remove it.

Actually — add a temporary closing, check syntax, then we'll extend in Task 2.

- [ ] **Step 4: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(docs): add DocumentProcessor with scanFolder"
```

---

### Task 2: Add extractText method

**Files:**
- Modify: `build/bin/build-tools.cjs` (continue DocumentProcessor object)

- [ ] **Step 1: Add extractText inside DocumentProcessor**

Remove the temporary `};` closing (if added) and add after `scanFolder`:

```javascript
  extractText(filePath, fileType) {
    const type = fileType || SUPPORTED_DOC_TYPES[path.extname(filePath).toLowerCase()];

    if (!type) {
      return { error: `Unsupported file type: ${path.extname(filePath)}`, type: 'error' };
    }

    // --- Claude-handled types (return marker, not text) ---
    if (type === 'pdf' || type === 'image') {
      return { path: filePath, type: 'claude-read', fileType: type };
    }

    if (type === 'figma') {
      // Read URL from file
      const url = readTextFile(filePath)?.trim();
      if (!url || !url.includes('figma.com')) {
        return { error: `Invalid Figma URL in ${filePath}`, type: 'error' };
      }
      return { path: filePath, url, type: 'claude-read', fileType: 'figma' };
    }

    // --- Node.js-handled types ---
    let text = '';

    if (type === 'docx') {
      // Check unzip availability
      if (!_execSyncRaw) {
        return { error: 'child_process not available', type: 'error' };
      }
      let unzipCheck;
      try { unzipCheck = _execSyncRaw('which unzip', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }); } catch {}
      if (!unzipCheck) {
        return { error: 'unzip not available. Install: apt install unzip (Linux) or brew install unzip (macOS)', type: 'error' };
      }
      const result = this._docExec(`unzip -p "${filePath}" word/document.xml 2>/dev/null`, 30000);
      if (result.error || !result.output) {
        return { error: `Failed to extract DOCX: ${result.error || 'unzip failed'}`, type: 'error' };
      }
      // Strip XML tags, preserve paragraph breaks
      text = result.output
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else if (type === 'pptx') {
      // List slides
      const listResult = this._docExecSimple(`unzip -l "${filePath}" 2>/dev/null | grep "ppt/slides/slide" | grep -v "_rels"`, { timeout: 10000 });
      if (!listResult) {
        return { error: 'Failed to list PPTX slides', type: 'error' };
      }
      const slideFiles = listResult.trim().split('\n')
        .map(line => line.trim().split(/\s+/).pop())
        .filter(f => f && f.endsWith('.xml'))
        .sort();

      const slides = [];
      for (let i = 0; i < slideFiles.length; i++) {
        const slideXml = this._docExecSimple(`unzip -p "${filePath}" "${slideFiles[i]}" 2>/dev/null`, { timeout: 10000 });
        if (slideXml) {
          const slideText = slideXml
            .replace(/<\/a:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          if (slideText) {
            slides.push(`## Slide ${i + 1}\n\n${slideText}`);
          }
        }
      }

      // Also try to extract speaker notes
      const notesResult = this._docExecSimple(`unzip -l "${filePath}" 2>/dev/null | grep "ppt/notesSlides" | grep -v "_rels"`, { timeout: 10000 });
      if (notesResult) {
        const noteFiles = notesResult.trim().split('\n')
          .map(line => line.trim().split(/\s+/).pop())
          .filter(f => f && f.endsWith('.xml'))
          .sort();

        for (let i = 0; i < noteFiles.length; i++) {
          const noteXml = this._docExecSimple(`unzip -p "${filePath}" "${noteFiles[i]}" 2>/dev/null`, { timeout: 10000 });
          if (noteXml) {
            const noteText = noteXml
              .replace(/<\/a:p>/g, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            if (noteText && slides[i]) {
              slides[i] += `\n\n**Speaker Notes:**\n${noteText}`;
            }
          }
        }
      }

      text = slides.join('\n\n---\n\n');
    } else if (type === 'yaml' || type === 'json') {
      text = readTextFile(filePath) || '';
      // Detect if it's an OpenAPI spec
      const isOpenAPI = text.includes('openapi:') || text.includes('"openapi"') || text.includes('swagger:') || text.includes('"swagger"');
      if (isOpenAPI) {
        text = `[OpenAPI Specification]\n\n${text}`;
      } else if (type === 'json') {
        // Skip non-OpenAPI JSON files (package.json, tsconfig.json, etc.)
        return { error: `Skipped ${filePath}: JSON file is not an OpenAPI spec`, type: 'error' };
      }
    } else {
      // markdown, text, plantuml, mermaid — read as-is
      text = readTextFile(filePath) || '';
    }

    if (!text) {
      return { error: `No text extracted from ${filePath}`, type: 'error' };
    }

    const wordCount = text.split(/\s+/).length;
    return { text, type: 'extracted', fileType: type, wordCount };
  },
```

- [ ] **Step 2: Verify syntax**

Temporarily close DocumentProcessor with `};`, run: `node -c build/bin/build-tools.cjs`
Expected: No errors. Remove temporary closing.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(docs): add extractText for DOCX, PPTX, YAML, text formats"
```

---

### Task 3: Add saveSource and populate methods, close DocumentProcessor

**Files:**
- Modify: `build/bin/build-tools.cjs` (finish DocumentProcessor object)

- [ ] **Step 1: Add saveSource and populate**

```javascript
  saveSource(relativePath, text, metadata) {
    if (!fs.existsSync(BRAIN_SOURCES_DIR)) {
      fs.mkdirSync(BRAIN_SOURCES_DIR, { recursive: true });
    }

    const sourcePath = this._sourcePath(relativePath);
    const content = [
      `# Source: ${path.basename(relativePath)}`,
      '',
      `**Type:** ${metadata?.fileType || 'unknown'}`,
      `**Extracted:** ${now()}`,
      `**Size:** ${metadata?.wordCount || 'unknown'} words`,
      `**Original:** ${relativePath}`,
      '',
      '---',
      '',
      text,
    ].join('\n');

    fs.writeFileSync(sourcePath, content, 'utf-8');
    return sourcePath;
  },

  populate(folderPath) {
    const manifest = this.scanFolder(folderPath);
    if (manifest.error) return manifest;

    if (manifest.total_supported === 0) {
      return { warning: 'No supported files found.', manifest };
    }

    const results = {
      extracted: [],
      claude_read: [],
      errors: [],
      manifest,
    };

    for (const file of manifest.files) {
      const extraction = this.extractText(file.path, file.type);

      if (extraction.type === 'error') {
        results.errors.push({ file: file.relative_path, error: extraction.error });
        continue;
      }

      if (extraction.type === 'claude-read') {
        // Save a placeholder source file pointing to the original
        this.saveSource(file.relative_path, `[This file requires Claude to read directly using the Read tool]\n\nOriginal file: ${file.path}`, {
          fileType: extraction.fileType,
          wordCount: 0,
        });
        results.claude_read.push({
          file: file.relative_path,
          path: file.path,
          fileType: extraction.fileType,
          url: extraction.url || null,
        });
        continue;
      }

      // Text successfully extracted — save source
      const sourcePath = this.saveSource(file.relative_path, extraction.text, {
        fileType: extraction.fileType,
        wordCount: extraction.wordCount,
      });
      results.extracted.push({
        file: file.relative_path,
        source: sourcePath,
        wordCount: extraction.wordCount,
        fileType: extraction.fileType,
      });
    }

    // Update project state
    const project = loadState('project') || {};
    project.docs_ingested = {
      folder: folderPath,
      files_processed: results.extracted.length + results.claude_read.length,
      files_errored: results.errors.length,
      timestamp: now(),
    };
    saveState('project', project);

    return results;
  },
};
```

This closing `};` is the real one — DocumentProcessor is complete.

- [ ] **Step 2: Verify syntax**

Run: `node -c build/bin/build-tools.cjs`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(docs): add saveSource, populate, and close DocumentProcessor"
```

---

## Chunk 2: CLI Subcommands + Command Updates

### Task 4: Add docs CLI subcommands

**Files:**
- Modify: `build/bin/build-tools.cjs` (Commands object + main help)

- [ ] **Step 1: Add docs command handler**

Search for the `scan` command in the Commands object. Add after it:

```javascript
  docs(args) {
    const sub = args[0];
    if (!sub || !['scan', 'extract', 'populate'].includes(sub)) {
      console.error('Usage: docs <scan|extract|populate> <path>');
      process.exit(1);
    }

    const target = args[1];
    if (!target) {
      console.error(`Usage: docs ${sub} <path>`);
      process.exit(1);
    }

    if (sub === 'scan') {
      const result = DocumentProcessor.scanFolder(target);
      if (result.error) {
        console.error(result.error);
        process.exit(1);
      }
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'extract') {
      const result = DocumentProcessor.extractText(target);
      if (result.type === 'error') {
        console.error(result.error);
        process.exit(1);
      }
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === 'populate') {
      console.log(`Processing documents from ${target}...`);
      const result = DocumentProcessor.populate(target);
      if (result.error) {
        console.error(result.error);
        process.exit(1);
      }
      if (result.warning) {
        console.log(`Warning: ${result.warning}`);
        return;
      }

      // Print report
      console.log(`\nDocument Ingestion Complete`);
      console.log(`  Folder: ${target}`);
      console.log(`  Files found: ${result.manifest.total_supported}`);
      console.log(`  Skipped: ${result.manifest.total_skipped}`);
      console.log('');

      if (result.extracted.length > 0) {
        console.log('  Extracted (Node.js):');
        for (const e of result.extracted) {
          console.log(`    ✓ ${e.file} → sources/${DocumentProcessor._flattenPath(e.file)}.md (${e.wordCount} words)`);
        }
      }

      if (result.claude_read.length > 0) {
        console.log('  Requires Claude to read:');
        for (const c of result.claude_read) {
          console.log(`    → ${c.file} (${c.fileType}) — Claude must read this directly`);
        }
      }

      if (result.errors.length > 0) {
        console.log('  Errors:');
        for (const e of result.errors) {
          console.log(`    ✗ ${e.file}: ${e.error}`);
        }
      }
    }
  },
```

- [ ] **Step 2: Add help text**

Search for `console.log('Commands:')` in main() and add after the `scan` help line:

```javascript
    console.log('  docs <scan|extract|populate> <path>  Document ingestion for brain seeding');
```

- [ ] **Step 3: Test scan**

Create a test docs folder:

```bash
mkdir -p /tmp/test-docs
echo "# Project Vision\n\nWe are building a task management API." > /tmp/test-docs/readme.md
echo "openapi: 3.0.0\npaths:\n  /tasks:\n    get:\n      summary: List tasks" > /tmp/test-docs/api.yaml
node build/bin/build-tools.cjs docs scan /tmp/test-docs
```

Expected: JSON manifest with 2 files, both supported.

- [ ] **Step 4: Test populate**

```bash
node build/bin/build-tools.cjs docs populate /tmp/test-docs
ls build/governance/brain/sources/
```

Expected: Report showing 2 extracted files. `sources/` directory contains `readme.md.md` and `api.yaml.md`.

- [ ] **Step 5: Clean up**

```bash
rm -rf /tmp/test-docs build/governance/brain/sources/
```

- [ ] **Step 6: Commit**

```bash
git add build/bin/build-tools.cjs
git commit -m "feat(docs): add docs CLI subcommands (scan, extract, populate)"
```

---

### Task 5: Update build-init.md with --docs flag

**Files:**
- Modify: `build/commands/build-init.md`
- Modify: `.claude/commands/build-init.md` (mirror)

- [ ] **Step 1: Read current build-init.md**

Read `build/commands/build-init.md` to find the initialization steps.

- [ ] **Step 2: Add --docs handling**

Add after the initial steps (project name/description) and before architecture discovery:

```markdown

### Document Ingestion (optional: --docs flag)

If the user provides `--docs <folder>`:

1. **Scan folder**
   Call `build-tools.cjs docs scan <folder>` to find supported files.
   Show manifest to user:
   ```
   Found N documents in <folder>:
     readme.md (markdown)
     srs.pdf (PDF — will read directly)
     architecture.pptx (PPTX)
     api-spec.yaml (OpenAPI)
     ...
   Skipped: demo.mp4 (unsupported)
   ```

2. **Extract and save**
   Call `build-tools.cjs docs populate <folder>`.
   Text-based files are extracted automatically.
   For files marked "claude-read" (PDFs, images):
   - Read each PDF using the Read tool (use `pages` parameter for >20 pages)
   - Read each image using the Read tool (multimodal)
   - For .figma-url files, call the Figma MCP `get_design_context` with the URL
   - Save the extracted/described content to `governance/brain/sources/` using Write tool

3. **Report what was extracted**
   ```
   Document ingestion complete:
     ✓ readme.md (450 words)
     ✓ srs.pdf (12,400 words, read directly)
     ✓ architecture.pptx (3,200 words)
     ✓ api-spec.yaml (850 words, OpenAPI spec)
   ```

4. **Read all sources before architecture discovery**
   Read every file in `governance/brain/sources/` to understand the project context.
   This informs the architecture discovery — skip questions for topics already covered in the documents.
   Only ask about GAPS:
   ```
   From your documents, I have good coverage of:
     ✓ Vision and goals (from srs.pdf)
     ✓ API contracts (from api-spec.yaml)

   Still need your input on:
     ? Architecture and tech stack
     ? Non-functional requirements
     ? Deployment strategy
   ```

If `--docs` is NOT provided, skip this section entirely. Architecture discovery runs as today.
```

- [ ] **Step 3: Copy to .claude/commands/**

```bash
cp build/commands/build-init.md .claude/commands/build-init.md
```

- [ ] **Step 4: Commit**

```bash
git add build/commands/build-init.md .claude/commands/build-init.md
git commit -m "feat(docs): add --docs flag to build-init command"
```

---

## Summary

| Task | Component | Lines Added (est.) |
|------|-----------|-------------------|
| 1 | Constants + scanFolder | ~60 |
| 2 | extractText (DOCX, PPTX, YAML, text) | ~100 |
| 3 | saveSource + populate | ~70 |
| 4 | docs CLI subcommands | ~60 |
| 5 | build-init.md --docs flag | ~50 |
| **Total** | | **~340 lines** |

5 tasks, 5 commits. Chunk 1 (Tasks 1-3) is the CJS DocumentProcessor. Chunk 2 (Tasks 4-5) is CLI wiring + command update.
