# Curricula - Obsidian Auto-Tutor & Curriculum Generator

An Obsidian plugin that turns your vault into a personalised, AI-driven learning environment. Drop in source material (PDFs, articles) or let the AI draw on its own knowledge to generate a scoped, proficiency-aware curriculum with lessons, navigation, and an Obsidian Canvas flowchart.

## Features

- **5-stage LLM pipeline**: Topic exploration, concept extraction, proficiency diagnostic, curriculum design, and lesson generation
- **Source-optional**: Works with or without user-provided source material
- **Three operating modes**: Grounded (sources authoritative), Augmented (sources + general knowledge), Knowledge-only (AI general knowledge)
- **Mobile-first**: Designed for Android foldable (primary) with full desktop support
- **Resumable**: Pause and resume course generation at any stage
- **Obsidian-native output**: Lessons, MOCs, Course Index, and Canvas flowchart

## Requirements

- Obsidian vault with four sub-folders: `1-Raw_Sources`, `2-Markdown_Sources`, `3-Synthesized`, `4-Curriculum`
- OpenRouter API key (for LLM access)
- Obsidian mobile on Android foldable (primary) or Obsidian desktop on macOS

## Installation via BRAT

1. Install the [BRAT (Beta Reviewers Auto-update Tester)](https://obsidian.md/plugins?id=obsidian42-brat) community plugin
2. Open Obsidian Settings → Community Plugins → BRAT
3. Click "Add a beta plugin"
4. Enter this repository URL: `https://github.com/anomalyco/obsidian-curricula`
5. Enable the "Curricula" plugin from your Community Plugins list

## Manual Installation (Development)

```bash
cd plugin
npm install
npm run build
```

Then copy `plugin/dist/` to your vault's `.obsidian/plugins/obsidian-auto-tutor/` directory.

## Setting Up the Vault

The plugin requires a specific vault structure:

```
<CourseVault>/
├── .obsidian/
│   └── plugins/obsidian-auto-tutor/     # plugin install location
├── 1-Raw_Sources/                       # PDFs, images — human-dropped
├── 2-Markdown_Sources/                  # docling output — machine-written
├── 3-Synthesized/                       # reserved (future)
└── 4-Curriculum/                        # lessons, MOCs, Course Index.md, course.canvas
```

## Configuration

1. Open Obsidian Settings → Curricula
2. Enter your OpenRouter API key
3. Select a default model (click "Refresh models" to fetch available models)
4. Optionally customize the prompt templates for each stage

## Development

```bash
# Install dependencies
cd plugin && npm install

# Build
npm run build

# Watch mode
npm run dev

# Typecheck
npm run typecheck

# Lint
npm run lint

# Tests
npm test

# Full verification
./scripts/verify.sh
```

## Optional: Mac-side Docling Service

For extracting text from PDFs and images, a Mac-side docling service is available:

```bash
cd docling-service
./install.sh --source /path/to/vault/1-Raw_Sources --target /path/to/vault/2-Markdown_Sources
```

## Architecture

The plugin runs a 5-stage DAG pipeline:

1. **Stage 0 — Topic Explorer**: User enters a seed topic; LLM generates a hierarchical taxonomy
2. **Stage 1 — Concept Extraction**: Extracts foundational concepts from scope + sources
3. **Stage 2 — Diagnostic**: User self-assesses proficiency per concept (Likert 1-5)
4. **Stage 3 — Curriculum Design**: LLM drafts a proficiency-aware syllabus; user edits
5. **Stage 4 — Content Generation**: Iteratively generates lesson content, MOCs, and Canvas

## License

MIT
