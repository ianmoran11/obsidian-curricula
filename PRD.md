# Project: Curricula -  Obsidian Auto-Tutor & Curriculum Generator

> **For the implementing agent:** This PRD is the single source of truth. Read the whole file before starting any task. Re-read **§5 Mobile Constraints** and **§13 Common Mistakes** before every new task — mobile Obsidian rules trip every first-time contributor. When a task's acceptance criteria are met, tick the checkbox and commit. Do not skip the test plan. Do not add features not in this PRD.

---

## 1. Overview

An Obsidian plugin that turns a dedicated vault into a personalised, AI-driven learning environment. The user *may* drop source material (PDFs, images, articles) into the vault — a Mac-side docling service extracts Markdown — and/or let the LLM draw on its own general knowledge. The plugin runs a 5-stage LLM pipeline (via OpenRouter) that produces a scoped, proficiency-aware curriculum with lessons, navigation, and an Obsidian Canvas flowchart.

**User-provided sources are optional, not required.** See §4.1 Source Material Policy — this is load-bearing and the implementing model gets it wrong by default, so re-read it.

**Primary runtime:** Obsidian mobile on Android foldable (inner ~8.1" and cover ~6.2" screens).
**Secondary runtime:** Obsidian desktop on macOS (used for ingestion via docling and for BRAT-based development).
**Sync:** Obsidian Sync keeps the vault consistent across devices.

## 2. Problem Statement

Self-directed learners accumulate scattered source material (PDFs, papers, tutorials) but have no efficient way to turn it into a structured curriculum that respects what they already know. Existing tools are desktop-only, cloud-locked, or require manual syllabus design. This plugin makes the phone — where most reading happens — the primary study surface, while keeping ingestion on a capable desktop.

## 3. Solution

1. **Mac-side docling service** *(optional path)* watches `/1-Raw_Sources` and writes Markdown conversions into `/2-Markdown_Sources`. If the user has no sources, this service is simply idle.
2. **Obsidian plugin** reads `/2-Markdown_Sources` if non-empty **and/or** leans on the LLM's pre-trained knowledge. Runs a resumable 5-stage DAG pipeline:
   - Stage 0 — Topic Explorer (taxonomy → user scoping)
   - Stage 1 — Concept Extraction
   - Stage 2 — Frictionless Diagnostic (Likert self-assessment)
   - Stage 3 — Curriculum Design (proficiency-aware syllabus)
   - Stage 4 — Iterative Content Generation (lessons + MOCs + `.canvas`)
3. **OpenRouter** is the LLM gateway; the service layer is abstracted so a local endpoint can replace it later.
4. **Verification workflow** uses standard automated tests (unit, integration, and local verification scripts) to validate behavior during implementation.

## 4. Glossary

| Term | Meaning |
|------|---------|
| Vault | An Obsidian folder with `.obsidian/` config. This plugin requires the four sub-folders in §6. |
| DAG | Directed Acyclic Graph — the 5 stages. Each stage consumes the previous stage's JSON output plus original inputs. |
| MOC | Map of Content — an Obsidian index note that links to children. |
| BRAT | Beta Reviewers Auto-update Tester — community plugin for sideloading dev builds. |
| docling | IBM's open-source document parser (https://github.com/DS4SD/docling). Extracts Markdown from PDFs, DOCX, images, etc. |
| Inner / cover screen | Galaxy Z Fold viewports. Inner ≈ 2176×1812@2.63dpr (tablet-like). Cover ≈ 2316×904@2.63dpr (narrow phone). |
| Long-context mode | MVP ingestion: concatenate all `/2-Markdown_Sources/*.md` into one string. Future alternatives (RAG, map-reduce) are out of scope. |
| Source-optional | The whole pipeline runs even when `/2-Markdown_Sources` is empty. The LLM's pre-trained knowledge is a first-class input, not a fallback. |

## 4.1 Source Material Policy (READ BEFORE WRITING ANY PROMPT OR STAGE)

The most common wrong assumption about this plugin is that sources are mandatory grounding. They are not.

**Principles:**

1. **Sources are optional, not required.** The user may run the full pipeline with zero files in `/2-Markdown_Sources`. Every stage must behave correctly when `contextText` is the empty string.
2. **The LLM's own knowledge is a first-class input.** When asked about "Linear Algebra" or "Kubernetes", the model has strong priors from pre-training. The plugin should exploit those priors, not suppress them.
3. **Three valid operating modes** (the implementing model must support all three; no mode is a fallback for the others):
   - **Grounded:** sources present and authoritative. LLM must ground concepts, examples, and explanations in the provided text where possible, citing `sourceRefs`.
   - **Augmented:** sources present but incomplete. LLM uses sources where available and freely supplements with general knowledge for gaps. `sourceRefs` lists files used; may be empty for concepts that came purely from general knowledge.
   - **Knowledge-only:** no sources. LLM uses general knowledge exclusively. `sourceRefs` is `[]` everywhere. Downstream validation must accept this.
4. **Prompts never say "only use the provided text".** Prompts say things like "prefer the provided text where it is authoritative; otherwise draw on your general knowledge of the topic".
5. **Validators never require non-empty `sourceRefs`.** `sourceRefs: []` is always valid.
6. **UI and copy reflect this.** Settings and the Stage 0 modal tell the user sources are optional; nothing gates the "Start Course" flow on source presence.
7. **Tests must cover all three modes.** Unit or integration tests must exercise grounded, augmented, and knowledge-only behavior where relevant.

**What this rules out:** strict RAG-style "no answer without a citation" behaviour; throwing errors when `/2-Markdown_Sources` is empty; prompts that say "answer only from the source".

**What this does NOT rule out:** when sources *are* provided and cover the topic, the LLM should prefer them over its priors (recency, domain specifics, user's framing). The policy is "optional grounding", not "ignore sources".

## 5. Mobile Constraints (READ BEFORE EVERY TASK)

Obsidian mobile runs in a **Capacitor WebView**, not Node. The implementing model must obey:

- **No Node built-ins.** `fs`, `path`, `child_process`, `os`, `crypto` (Node variant), `buffer` are all **unavailable**. Use Obsidian's `Vault` and `DataAdapter` API.
- **No `fetch()` for external HTTP.** Use Obsidian's `requestUrl()` helper — it bypasses CORS and works uniformly across platforms. `fetch()` against `openrouter.ai` will fail on mobile.
- **Manifest must set `"isDesktopOnly": false`.**
- **Touch targets ≥ 48×48px.** Use Obsidian's existing CSS variables (`--size-4-4`, etc.) where possible.
- **Memory ceilings are real.** Stream large files through the adapter; do not `JSON.parse` megabyte blobs without chunking.
- **Layout must respond to folded/unfolded viewports.** Use CSS container queries or `window.matchMedia`. Standard tests should cover the responsive logic where practical.
- **No dynamic `eval`, no `new Function()`.** Android WebView CSP blocks them.
- **File paths are POSIX-style and vault-relative.** Never store absolute paths in `data.json` — they differ per device.
- **Use `Platform.isMobile` / `Platform.isAndroidApp`** from `obsidian` to branch UI where unavoidable. Prefer a single responsive layout.

## 6. Vault Structure (Required)

```
<CourseVault>/
├── .obsidian/
│   └── plugins/obsidian-auto-tutor/     # plugin install location
├── 1-Raw_Sources/                       # PDFs, images — human-dropped
├── 2-Markdown_Sources/                  # docling output — machine-written
├── 3-Synthesized/                       # reserved (future)
├── 4-Curriculum/                        # lessons, MOCs, Course Index.md, course.canvas
└── .auto-tutor.lock                     # generation-in-progress lockfile (transient)
```

Plugin `data.json` (inside `.obsidian/plugins/obsidian-auto-tutor/`) holds settings and small cache. Large stage payloads go into the plugin's private `<plugin>/cache/<courseId>/stageN.json`.

## 7. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      mac mini (desktop)                        │
│  ┌───────────────┐    ┌────────────────┐    ┌──────────────┐   │
│  │/1-Raw_Sources │──▶│ docling-service │──▶│/2-Markdown_..│   │
│  └───────────────┘    │ (Python+launchd)│    └──────────────┘   │
│                                        │            │            │
│                         Obsidian Sync ─┼────────────┘            │
└─────────────────────────────────────────┼────────────────────────┘
                                          │
┌─────────────────────────────────────────┼────────────────────────┐
│                    Android foldable (primary)                    │
│                    Obsidian mobile + plugin                     │
│                                          │                        │
│   ┌──────────────────────────────────────▼────────────────────┐   │
│   │  Plugin Pipeline (resumable, cached per stage)            │   │
│   │                                                            │   │
│   │  Stage 0 ──▶ Stage 1 ──▶ Stage 2 ──▶ Stage 3 ──▶ Stage 4 │   │
│   │     │           │           │           │           │     │   │
│   │     └───────── Cache (JSON) ──────────────────────┘       │   │
│   │                                                            │   │
│   │                     OpenRouterService                      │   │
│   └───────────────────────────▲────────────────────────────────┘   │
│                               │ requestUrl()                       │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                     https://openrouter.ai/api/v1
```

## 8. User Flow (text diagram)

```
[User opens Obsidian mobile in Course Vault]
       │
       ▼
[Command Palette → "Auto-Tutor: Start New Course"]   or [ribbon icon]
       │
       ▼
┌──────────────────────────────────────────┐
│ Modal: enter seed topic (e.g. "ML")      │  Stage 0 input
└──────────────────────────────────────────┘
       │
       ▼  POST /chat/completions (Stage 0 prompt + seed)
┌──────────────────────────────────────────┐
│ Tree-view UI (hierarchical taxonomy).    │
│ Inner screen: indented expandable tree.  │
│ Cover screen: one-column + breadcrumbs.  │
│ User checks/unchecks nodes → "Continue"  │
└──────────────────────────────────────────┘
       │  scopedTaxonomy.json → cache
       ▼  concatenate /2-Markdown_Sources/* → context string
┌──────────────────────────────────────────┐  Stage 1
│ POST /chat/completions (extract concepts)│
│ Receives Concept[]                       │
└──────────────────────────────────────────┘
       │  concepts.json → cache
       ▼
┌──────────────────────────────────────────┐  Stage 2
│ Likert modal: swipe/tap per concept      │
│ 1=Unfamiliar ◯──◯──◯──◯──◯ 5=Expert       │
│ "Finish assessment" → ProficiencyMap     │
└──────────────────────────────────────────┘
       │  proficiency.json → cache
       ▼  Stage 3 prompt (scope + sources + proficiency)
┌──────────────────────────────────────────┐
│ Draft syllabus view. User can add/remove │
│ lessons, reorder, rename, "Finalize"     │
└──────────────────────────────────────────┘
       │  curriculum.json → cache
       ▼  Stage 4 — iterate per lesson
┌──────────────────────────────────────────┐
│ Progress view: "Generating 3/14…"         │
│ Writes .md to /4-Curriculum/<Module>/     │
│ Writes MOCs, Course Index.md, course.canvas│
│ Atomic writes (tmp file + rename)         │
└──────────────────────────────────────────┘
       │
       ▼
[User navigates Course Index → Lesson; breadcrumbs + prev/next links work]
```

Any stage can be paused/resumed — cache is written synchronously before advancing.

## 9. Directory Layout (this repo)

```
obsidian-curricula/
├── PRD.md                              # this file
├── ralph/                              # submodule, do not modify
├── progress.txt                        # ralph-generated
├── plugin/                             # Obsidian plugin source
│   ├── manifest.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── esbuild.config.mjs
│   ├── main.ts                         # plugin entrypoint (thin)
│   ├── styles.css
│   ├── src/
│   │   ├── interfaces.ts               # §10 — DAG payload types
│   │   ├── constants.ts                # model IDs, endpoints, paths
│   │   ├── plugin.ts                   # main Plugin subclass logic
│   │   ├── settings.ts                 # SettingTab + settings persistence
│   │   ├── services/
│   │   │   ├── openrouter.ts           # LLM gateway abstraction
│   │   │   ├── context.ts              # long-context builder
│   │   │   ├── cache.ts                # per-course per-stage cache
│   │   │   ├── validator.ts            # JSON schema validation
│   │   │   └── lock.ts                 # .auto-tutor.lock handling
│   │   ├── stages/
│   │   │   ├── stage0-topic.ts
│   │   │   ├── stage1-concepts.ts
│   │   │   ├── stage2-diagnostic.ts
│   │   │   ├── stage3-curriculum.ts
│   │   │   └── stage4-generate.ts
│   │   ├── ui/
│   │   │   ├── topic-input-modal.ts
│   │   │   ├── taxonomy-view.ts        # responsive tree (inner) / column+breadcrumb (cover)
│   │   │   ├── likert-modal.ts
│   │   │   ├── syllabus-editor-view.ts
│   │   │   ├── progress-view.ts
│   │   │   └── common.ts               # responsive helpers
│   │   ├── writers/
│   │   │   ├── markdown.ts             # lesson .md writer
│   │   │   ├── canvas.ts               # .canvas generator
│   │   │   ├── navigation.ts           # breadcrumbs / prev-next
│   │   │   ├── moc.ts                  # map-of-content generator
│   │   │   └── frontmatter.ts          # yaml builder
│   │   └── prompts/                    # bundled .md templates (loaded at runtime)
│   │       ├── stage0-taxonomy.md
│   │       ├── stage1-concepts.md
│   │       ├── stage3-curriculum.md
│   │       └── stage4-lesson.md
│   └── tests/
│       ├── unit/
│       ├── fixtures/
│       └── vitest.config.ts
├── docling-service/                    # Mac-side extraction
│   ├── pyproject.toml
│   ├── extract.py                      # single-file extraction
│   ├── watch.py                        # long-running watcher
│   ├── com.user.auto-tutor.docling.plist
│   ├── install.sh
│   ├── uninstall.sh
│   └── README.md
├── mock-vault/                         # dev/test vault (committed, contents mostly gitignored)
│   ├── .obsidian/
│   ├── 1-Raw_Sources/.gitkeep
│   ├── 2-Markdown_Sources/
│   │   ├── intro-to-ml.md              # fixture
│   │   └── linear-algebra-primer.md    # fixture
│   ├── 3-Synthesized/.gitkeep
│   └── 4-Curriculum/.gitkeep
├── scripts/
│   ├── setup-mock-vault.sh
│   ├── install-plugin.sh               # symlinks plugin/dist → mock-vault/.obsidian/plugins/…
│   └── verify.sh                       # lint + typecheck + test wrapper
└── .github/
    └── workflows/
        └── ci.yml                      # lint, typecheck, unit tests (no secrets)
```

## 10. TypeScript Interfaces (`plugin/src/interfaces.ts`)

Create this file verbatim. Every stage consumes and produces one of these. Treat them as contracts.

```ts
// plugin/src/interfaces.ts

export type CourseId = string;   // slugified seed topic + timestamp

export interface CourseMeta {
  courseId: CourseId;
  seedTopic: string;
  createdAt: string;             // ISO 8601
  lastStageCompleted: 0 | 1 | 2 | 3 | 4 | null;
  modelUsed: string;             // e.g. "anthropic/claude-3.5-haiku"
}

/** Stage 0 — Taxonomy */
export interface TaxonomyNode {
  id: string;                    // stable, e.g. "ml.supervised.trees"
  title: string;
  description?: string;
  children: TaxonomyNode[];
}

export interface ScopedTaxonomy {
  courseId: CourseId;
  root: TaxonomyNode;            // full tree returned by LLM
  selectedIds: string[];         // node ids user kept checked
}

/** Stage 1 — Concepts */
export interface Concept {
  id: string;                    // stable slug
  name: string;
  definition: string;            // ≤ 200 chars
  sourceRefs: string[];          // filenames from /2-Markdown_Sources; [] when the concept
                                 // came from the LLM's general knowledge (knowledge-only
                                 // or augmented mode — see §4.1). ALWAYS VALID EMPTY.
}

export interface ConceptList {
  courseId: CourseId;
  concepts: Concept[];
}

/** Stage 2 — Proficiency */
export type LikertScore = 1 | 2 | 3 | 4 | 5;

export interface ProficiencyMap {
  courseId: CourseId;
  scores: Record<string /* conceptId */, LikertScore>;
}

/** Stage 3 — Curriculum */
export interface LessonSpec {
  id: string;
  title: string;
  summary: string;
  prerequisiteLessonIds: string[];
  relatedConceptIds: string[];
  difficulty: 'intro' | 'intermediate' | 'advanced';
  condensed: boolean;            // true if user proficient ≥4
}

export interface ModuleSpec {
  id: string;
  title: string;
  lessons: LessonSpec[];
}

export interface Curriculum {
  courseId: CourseId;
  title: string;
  modules: ModuleSpec[];
}

/** Stage 4 — Output tracking */
export interface GeneratedLesson {
  lessonId: string;
  filePath: string;              // vault-relative
  status: 'pending' | 'writing' | 'written' | 'error';
  error?: string;
  sourceRefs: string[];          // for provenance frontmatter
}

export interface GenerationProgress {
  courseId: CourseId;
  lessons: GeneratedLesson[];
  canvasPath?: string;
  indexPath?: string;
  startedAt: string;
  completedAt?: string;
}

/** Cache shape on disk */
export interface StageCache {
  meta: CourseMeta;
  stage0?: ScopedTaxonomy;
  stage1?: ConceptList;
  stage2?: ProficiencyMap;
  stage3?: Curriculum;
  stage4?: GenerationProgress;
}
```

## 11. Prompt Templates

All prompts live at `plugin/src/prompts/*.md` and are bundled into `main.js` via an esbuild text loader plugin. Settings tab exposes them for power-user editing; edits are persisted in `data.json`, falling back to the bundled default when empty.

Every OpenRouter call must include `response_format: { type: 'json_object' }` when a JSON payload is expected, and the system prompt must restate the schema.

**Source Material Policy in prompts (see §4.1):** prompts that reference `{{contextText}}` MUST be written so the LLM can operate when `contextText` is empty or partial. The pattern is "prefer provided sources where authoritative; otherwise use your own general knowledge of the topic". Do NOT use phrases like "only from the source", "cite the text for every claim", "refuse if no source". When `contextText` is empty the plugin replaces the SOURCE block with the literal string `(no user-provided sources — rely on your general knowledge of the topic)` — every prompt below must make sense with that substitution.

### 11.1 Stage 0 — Taxonomy (`stage0-taxonomy.md`)

```
You are a curriculum designer. Given a seed topic, produce a hierarchical taxonomy of the subject as JSON. Three levels max: area → sub-area → leaf topic. Each node has a stable dot-notation id, a title ≤ 60 chars, and an optional one-line description.

Output JSON EXACTLY matching:
{ "root": { "id": "...", "title": "...", "description": "...", "children": [ ... ] } }

Seed topic: {{seedTopic}}

Return JSON only. No prose, no markdown fences.
```

### 11.2 Stage 1 — Concepts (`stage1-concepts.md`)

```
You extract foundational concepts for a learning curriculum, filtered by a user-defined scope.

You have TWO knowledge sources available:
  (a) USER-PROVIDED SOURCES below, which may be empty, partial, or authoritative.
  (b) Your own general knowledge of the topic from pre-training.

Use BOTH. Prefer the user-provided sources where they are authoritative on a concept; otherwise rely on your general knowledge. If no sources are provided, rely on general knowledge exclusively — this is a valid mode, not an error.

SCOPE (selected taxonomy node ids):
{{selectedNodeIds}}

USER-PROVIDED SOURCES (concatenated Markdown — may be empty):
---
{{contextText}}
---

Return JSON EXACTLY:
{ "concepts": [ { "id": "slug", "name": "...", "definition": "≤200 chars", "sourceRefs": ["filename.md"] } ] }

Rules:
- 15 ≤ concepts.length ≤ 40.
- sourceRefs lists filenames from USER-PROVIDED SOURCES that directly support the concept. `sourceRefs: []` is valid and expected when the concept comes from general knowledge or when no sources were provided.
- Do NOT fabricate filenames. Only list files that actually appeared in USER-PROVIDED SOURCES.
- Ids are lowercase-hyphen slugs, unique within the list.
- Do not include concepts outside the scope.
- Return JSON only.
```

### 11.3 Stage 3 — Curriculum (`stage3-curriculum.md`)

```
You are designing a personalised syllabus.

Draw on BOTH the user-provided sources below (which may be empty) and your own general knowledge of the topic. The curriculum should be comprehensive and well-structured even when sources are sparse or absent — lean on your pre-trained knowledge to fill gaps.

SCOPE: {{selectedNodeIds}}
CONCEPTS: {{concepts}}            (from Stage 1)
PROFICIENCY: {{proficiencyMap}}    (1=Unfamiliar … 5=Expert)
USER-PROVIDED SOURCES (may be empty):
---
{{contextText}}
---

Produce a Curriculum matching this schema:
{ "title": "...", "modules": [ { "id": "...", "title": "...", "lessons": [
  { "id": "...", "title": "...", "summary": "...",
    "prerequisiteLessonIds": ["..."],
    "relatedConceptIds": ["..."],
    "difficulty": "intro"|"intermediate"|"advanced",
    "condensed": true|false } ] } ] }

Hard rules:
- Modules 3–7, each with 3–8 lessons.
- Absent sources do not reduce curriculum coverage. A knowledge-only run should produce the same shape as a grounded run.
- For any concept where the user scored ≥4, either omit lessons that only cover it OR set "condensed": true for the lesson and keep its summary ≤ 2 sentences.
- Every lesson has ≥1 entry in relatedConceptIds that exists in CONCEPTS.
- prerequisiteLessonIds must reference ids defined earlier in the same JSON document (no cycles).
- Return JSON only.
```

### 11.4 Stage 4 — Lesson (`stage4-lesson.md`)

```
Write one lesson in Obsidian-flavoured Markdown.

You have TWO knowledge sources:
  (a) USER-PROVIDED SOURCES below, which may be empty, partial, or comprehensive.
  (b) Your own general knowledge of the topic from pre-training.

Use both. When user-provided sources cover the lesson's topic, prefer them — match their terminology, framing, and examples. When they don't cover it, or are absent entirely, draw freely on your general knowledge. A lesson written purely from general knowledge is valid and expected when no sources are provided. Do NOT refuse, stall, or apologise about missing sources — just teach the material.

LESSON SPEC: {{lesson}}
RELATED CONCEPTS (with definitions): {{relatedConcepts}}
USER-PROVIDED SOURCES (may be empty):
{{contextText}}

Output rules:
- Start with a level-1 heading equal to the lesson title.
- 400–900 words unless "condensed": true, in which case 120–250 words.
- Include at least one worked example and one "Check your understanding" question with answer in a callout (> [!question]).
- Use [[wikilinks]] to reference related concepts by their name field.
- Do NOT include YAML frontmatter — the plugin will inject it.
- Do NOT include navigation links — the plugin will inject breadcrumbs and prev/next.
- Do NOT include meta-commentary like "based on the provided sources" or "since no source was given" — write the lesson directly.
- Return raw Markdown only, no code fences around the whole file.
```

## 12. Service Layer Contracts

### 12.1 `OpenRouterService` (`plugin/src/services/openrouter.ts`)

```ts
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}
export interface ChatResult { content: string; usage: { inputTokens: number; outputTokens: number; }; }

export interface LlmService {
  chat(opts: ChatOptions): Promise<ChatResult>;
  listModels(): Promise<{ id: string; name: string; contextLength: number }[]>;
}
```

**Implementation rules:**
- Use `requestUrl()` from `obsidian`, never `fetch`.
- Read API key from `settings.openRouterApiKey`.
- POST to `https://openrouter.ai/api/v1/chat/completions`.
- `listModels()` hits `https://openrouter.ai/api/v1/models` and caches for 1 h in `data.json`.
- All errors thrown as `LlmError` with `.status`, `.body`, `.retriable`.
- Retry (exponential backoff, max 3 tries) only when `retriable === true` (5xx, 429, network).
- Never log the API key. Redact headers before any `console.debug`.

### 12.2 `CacheService` (`plugin/src/services/cache.ts`)

- Directory: `<pluginDir>/cache/<courseId>/`
- Each stage writes `stageN.json` **atomically** (`.tmp` file + rename via `adapter.rename`).
- Reads validate against `interfaces.ts` types (use the validator).
- Provides `resumeFrom(courseId): { nextStage: 0..4, cache: StageCache }`.

### 12.3 `ContextBuilder` (`plugin/src/services/context.ts`)

- Reads all `/2-Markdown_Sources/*.md` via the vault API (recursive).
- Concatenates with `\n\n===== {filename} =====\n\n` separators.
- Returns `{ text: string, files: string[], byteLength: number, mode: 'grounded' | 'knowledge-only' }`.
- **Empty sources are valid.** If zero `.md` files are found, returns `{ text: '(no user-provided sources — rely on your general knowledge of the topic)', files: [], byteLength: <len of that literal>, mode: 'knowledge-only' }`. Do not throw, do not prompt the user to add sources.
- Prompts that reference `{{contextText}}` substitute this value directly — the literal string is the signal to the LLM (see §4.1).
- If `byteLength > modelContextLength * 3` (rough char→token estimate), **throw** a typed `ContextTooLargeError` telling the user to pick a larger-context model or trim sources. Do not silently truncate.
- **Run-level mode classification:** the plugin runtime only distinguishes `grounded` vs `knowledge-only` at context-build time. `augmented` is assigned after generation: if source files were present but any accepted Stage 1 concept or Stage 4 lesson legitimately uses `sourceRefs: []`, classify the run as `augmented`; otherwise classify it as `grounded`. Tests should use this exact rule when labelling runs.

### 12.4 `Validator` (`plugin/src/services/validator.ts`)

- Use `zod` (listed in dependencies) to mirror every interface in §10.
- Each stage calls `parse(llmJson)` — on failure, retry the LLM call **once** with a follow-up user message: `"Your previous response failed validation: <errors>. Return valid JSON only."`.
- Second failure surfaces a user-visible error in the progress view.

### 12.5 `LockService` (`plugin/src/services/lock.ts`)

- On Stage 4 start: write `<vault>/.auto-tutor.lock` with JSON `{ courseId, deviceName, startedAt }`.
- On start of any stage, if lock exists and `Date.now() - startedAt < 30min`, refuse to start; show modal `"Generation in progress on <deviceName>. Cancel?"`.
- Lock is deleted on successful completion and on user cancel.
- Stale locks (≥30 min) are auto-cleared.

## 13. Common Mistakes to Avoid

1. **Using `fetch()` instead of `requestUrl()`** — works on desktop, fails silently or with CORS on mobile.
2. **Importing `node:fs` or `path`** — will compile but crash at runtime on Android.
3. **Forgetting `isDesktopOnly: false`** — plugin won't show on mobile.
4. **Inline prompts** — prompts MUST be in `plugin/src/prompts/*.md`, loaded via esbuild text plugin, editable via settings.
5. **Writing directly to the final file** — always write `.tmp` then `adapter.rename` for atomicity.
6. **Putting cache in the vault root** — cache lives in `<pluginDir>/cache/`, not `/3-Synthesized`.
7. **Blocking the main thread with large concatenations** — context builder must `yield` (await microtask) between files if source count > 20.
8. **Hard-coded viewport assumptions** — responsive behavior should be driven by shared helpers/constants, not duplicated magic numbers.
9. **Leaking the API key** — never log the key or include it in fixtures, snapshots, or debug output.
10. **Tree-view assumes inner screen** — always implement cover-screen layout at the same time.
11. **Assuming sources are required** — the whole pipeline runs with zero source files. Every prompt, validator, and UI path must handle the empty-sources case cleanly. `sourceRefs: []` is always valid. See §4.1.
12. **Writing prompts that refuse without sources** — prompts like "only answer from the provided text" are wrong for this project. The LLM's own knowledge is a first-class input. See §4.1 and the prompt templates in §11.

## 14. Acceptance Criteria (per feature)

Each criterion maps to at least one task in §16. A feature is "done" only when every bullet under it is demonstrably true.

### F1. Mock vault
- `mock-vault/` exists with the four required sub-folders.
- Contains 2 Markdown fixtures in `/2-Markdown_Sources/` totalling ≥ 1,000 words (for grounded-mode testing).
- A second vault variant `mock-vault-empty/` (or a test helper that clears `/2-Markdown_Sources/` on the fly) exists for knowledge-only-mode testing. See §4.1.
- `scripts/install-plugin.sh` symlinks `plugin/dist` into both vaults' `.obsidian/plugins/obsidian-auto-tutor/` idempotently.
- Opening either vault in Obsidian desktop shows the plugin in the Community Plugins list.

### F2. Plugin scaffold
- `plugin/manifest.json` valid, `isDesktopOnly: false`, `minAppVersion ≥ 1.5.0`.
- `npm run build` in `plugin/` produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`.
- `npm run typecheck` passes.
- `npm test` runs Vitest (0 failures, ≥1 placeholder test).
- Plugin registers one command `auto-tutor:start-new-course` and one ribbon icon.

### F3. Settings tab
- Fields: OpenRouter API key (password type), default model (dropdown sourced from `listModels()` with manual-entry fallback), expandable text areas for all four prompts.
- Saves to `data.json`; reloads on Obsidian restart.
- "Test connection" button calls `/models` and shows success / error toast.
- Passwords never printed to console.

### F4. Docling service
- `docling-service/install.sh` installs a user-level `launchd` agent that runs `watch.py`.
- Watcher detects file additions/changes in `/1-Raw_Sources` (any depth) within 10 s.
- For each new file, produces a corresponding `.md` in `/2-Markdown_Sources/` with the same stem (sanitised) and frontmatter `source: <original relative path>`, `extracted_at: <ISO>`.
- Re-running on an unchanged file is a no-op (content-hash cache in `.docling-cache/`).
- Logs to `~/Library/Logs/auto-tutor-docling.log`; rotated at 10 MB.
- `uninstall.sh` removes the launch agent cleanly.

### F5. OpenRouter service layer
- `listModels()` returns ≥ 1 result when a valid key is configured.
- `chat()` honours `responseFormat: 'json_object'` (verified with a golden test that parses the response).
- Retries on 429/5xx exactly 3 times with jittered backoff; does not retry on 4xx other than 429.
- Aborts cleanly when `signal` fires.

### F6. Context builder
- Concatenates all `.md` in `/2-Markdown_Sources` (recursive) in stable alphabetic order.
- Uses the separator format in §12.3.
- **Empty sources:** returns `mode: 'knowledge-only'` with the literal placeholder string from §12.3. Does NOT throw, does NOT error — this is a supported mode per §4.1.
- **Populated sources:** returns `mode: 'grounded'`.
- Throws `ContextTooLargeError` when oversized; error names the current model and suggests two higher-context alternatives from `listModels()`.

### F7. Stage 0 — Topic Explorer
- Modal accepts seed topic (trim, reject empty).
- LLM call produces a `TaxonomyNode` tree validated by zod; on validation failure, one auto-retry per §12.4.
- Tree view renders on inner viewport (indented, expandable) and cover viewport (one column + breadcrumb back button).
- Every node has a checkbox; parent toggles cascade to descendants.
- "Continue" is disabled until ≥ 1 leaf is selected.
- Output cached as `stage0.json` before advancing.

### F8. Stage 1 — Concept Extraction
- Input: `ScopedTaxonomy` + long context (may be knowledge-only per §4.1).
- Validates `ConceptList` per zod. `sourceRefs: []` is always valid.
- 15 ≤ concepts.length ≤ 40, regardless of whether sources were provided.
- Grounded-mode run: at least 50% of concepts have non-empty `sourceRefs` (where the provided text meaningfully covers them).
- Knowledge-only-mode run: every concept has `sourceRefs: []`. Run completes without error.
- Cached as `stage1.json`.

### F9. Stage 2 — Diagnostic
- Modal renders one concept at a time with Likert 1–5 and "skip"; tap target ≥ 48 px.
- Cover screen: single-column, full-width.
- Back button revises a previous answer.
- Output `ProficiencyMap` covers every concept id from Stage 1 (skipped concepts recorded as `3`).
- Cached as `stage2.json`.

### F10. Stage 3 — Curriculum Design
- Produces `Curriculum` with 3–7 modules, 3–8 lessons each — **same shape for grounded, augmented, and knowledge-only modes** (§4.1). Tests must cover at least one knowledge-only run to prove coverage does not degrade without sources.
- Proficiency ≥ 4 concepts result in `condensed: true` lessons or omission.
- Editor view allows: rename module/lesson, delete lesson, reorder (drag handle ≥ 48 px tall), add blank lesson (minimum fields).
- "Finalize" saves `stage3.json`.

### F11. Stage 4 — Content Generation
- For each lesson: writes `.md` to `/4-Curriculum/<Module Slug>/<Lesson Slug>.md` with:
  - YAML frontmatter: `status: unread`, `difficulty`, `lessonId`, `moduleId`, `sourceRefs`, `generated_at`, `generation_mode` (one of `grounded` / `augmented` / `knowledge-only`).
  - Breadcrumb at top: `[[Course Index]] > [[<Module MOC>]]`.
  - Prev/next footer using actual wikilinks.
- Lesson body meets length and structure rules from §11.4 in all three modes. Knowledge-only lessons are written directly — no "I don't have sources" preamble (the Stage 4 prompt forbids this).
- Writes MOC per module and `Course Index.md`.
- Generates `course.canvas` with nodes in a layered grid (modules = columns, lessons stacked below, ~320×200) and edges from `prerequisiteLessonIds`.
- Filename collisions appended with `-2`, `-3`, … deterministically.
- Resumable: killing Obsidian mid-generation and reopening shows the progress view at the correct lesson.

### F12. Native navigation
- `Course Index.md` exists with links to every module MOC.
- Clicking any lesson's breadcrumb reaches `Course Index.md` in ≤ 2 taps.
- Prev/next loop is complete (last lesson's "next" points to `Course Index.md`).

### F13. State recovery
- Killing Obsidian (or switching devices via Obsidian Sync) at any point restores the in-progress stage on next plugin load, driven solely by `cache/<courseId>/stageN.json` and `CourseMeta.lastStageCompleted`.
- `.auto-tutor.lock` prevents duplicate concurrent generation.

### F14. Verification workflow
- `scripts/verify.sh` runs the standard local quality checks for this repo: lint, typecheck, and tests.
- Automated verification relies on unit tests, fixture-driven tests, and env-gated integration tests. No Playwright, browser simulation, or recording harness is required for now.
- The core three modes (`grounded`, `augmented`, `knowledge-only`) are covered by automated tests where relevant.
- CI runs the same standard checks, with integration tests gated behind secrets or environment variables.

### F15. BRAT release
- `plugin/manifest.json` has `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `authorUrl`, `isDesktopOnly: false`.
- `plugin/versions.json` present.
- A GitHub release containing `main.js`, `manifest.json`, `styles.css` is produced by a tag `vX.Y.Z`.
- `README.md` in repo root documents BRAT install steps.

## 15. Test Plan

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | validators, canvas generator, navigation writer, frontmatter, cache, context builder, lock service |
| Integration | Vitest + real OpenRouter (opt-in via `OPENROUTER_API_KEY`) | `OpenRouterService.chat` against cheap model; one golden JSON-mode test; `listModels` |
| Manual | Local Obsidian smoke test | spot-check the main course flow when needed |

**CI (`.github/workflows/ci.yml`):** lint, typecheck, unit tests. Integration tests are gated behind a secret and run locally or on a suitable runner.

**Test data:** `plugin/tests/fixtures/` contains canned LLM responses (valid + invalid JSON) used by unit tests. Do **not** hit the API in unit tests.

**Must-have tests (non-exhaustive):**
- `validator.test.ts` — valid & malformed fixtures for every interface.
- `canvas.test.ts` — deterministic output; layered grid coordinates; edge direction correct.
- `navigation.test.ts` — first/last lesson prev/next edge cases.
- `frontmatter.test.ts` — YAML escaping (quotes, colons, multiline).
- `cache.test.ts` — atomic write: inject a crash between `.tmp` and rename; cache stays consistent.
- `context.test.ts` — stable ordering; `ContextTooLargeError` thrown above threshold; empty `/2-Markdown_Sources/` returns `mode: 'knowledge-only'` with the §12.3 placeholder and does not throw.
- `source-policy.test.ts` — asserts that (a) bundled prompts contain no forbidden phrases (`only from the source`, `refuse if no`, `cannot answer without`), (b) Stage 1/3/4 prompt-composers substitute the knowledge-only placeholder when `contextText` is empty, (c) `ConceptList` validator accepts `sourceRefs: []`.
- `openrouter.test.ts` (integration) — JSON mode returns parseable JSON; retry happens on simulated 429.
- `lock.test.ts` — stale-lock auto-clear at 30 min; active lock blocks start.

## 16. Verification Workflow

Standard automated tests are the primary verification mechanism for now. Focus on unit tests, fixture-driven tests, integration tests where APIs are involved, and a simple local verification script that runs the main checks from the repo root.

### 16.1 Required local verification

Before marking a substantial task complete, run the relevant subset of:

```bash
npm run lint
npm run typecheck
npm test
scripts/verify.sh
```

If a task changes OpenRouter integration, run the env-gated integration tests when credentials are available. If a task is UI-heavy, a lightweight local Obsidian smoke check is sufficient; no Playwright, recording harness, or browser simulation is required.

### 16.2 What makes a task complete

A task from §Tasks is not complete until all of the following are true:

1. Code changes committed.
2. Unit tests for the relevant feature pass locally (`npm test`).
3. The task's non-test acceptance criteria pass.
4. The `- [ ]` checkbox in this PRD is ticked and the commit message references the task number.

If any of the applicable requirements above fails, leave the checkbox unticked, note the blocker in `progress.txt`, and pick up next iteration.

### 16.3 Verification scope

- Prefer deterministic tests over manual or simulated UI recording.
- Use fixture-driven tests for LLM outputs and mode coverage (`grounded`, `augmented`, `knowledge-only`).
- Keep integration tests opt-in when they require live credentials or network access.
- Manual verification should be lightweight and targeted, not a separate artifact production workflow.

## 17. Dependencies

### Plugin (`plugin/package.json`)
- Runtime: `obsidian` (peer), `zod` (validation).
- Dev: `typescript`, `esbuild`, `esbuild-plugin-text` (or equivalent), `vitest`, `@types/node`, `eslint`, `prettier`.

### Docling service (`docling-service/pyproject.toml`)
- `docling`, `watchdog`, `pyyaml`, `python-dotenv`.
- Python ≥ 3.11.

### Verification scripts
- No separate browser-automation workspace is required for now.

### System
- macOS for docling service (launchd).
- Android Obsidian ≥ latest stable on the Z Fold.
- Obsidian Sync enabled.

## 18. Constraints Summary

- No telemetry, no network beyond OpenRouter and (read-only) OpenRouter `/models`.
- All user data stays in the vault; no exports.
- Plugin size budget: `main.js` ≤ 500 KB.
- Cold-start Stage 0 (seed → rendered tree) target: ≤ 15 s on a cheap model over Wi-Fi.
- Everything in §5 Mobile Constraints.

---

## Tasks

> Work tasks top-to-bottom. Each task is one PR/commit. When a task completes, tick its checkbox AND append a one-line note to `progress.txt` (ralph does this automatically if configured). Do not open a new task if the previous one left red tests.

### Phase 1: Foundations

- [x] 1. Create `mock-vault/` with `.obsidian/`, the four required sub-folders, and two fixture Markdown files in `/2-Markdown_Sources/` (intro-to-ml.md ~700 words, linear-algebra-primer.md ~500 words; fabricate plausible content, keep concepts simple). Also create `mock-vault-empty/` with the same structure but an empty `/2-Markdown_Sources/` (for knowledge-only-mode testing per §4.1) — a script-generated helper is fine instead of a second committed vault if preferred. Add a `.gitignore` inside `mock-vault/` that ignores `.obsidian/workspace*`, `.obsidian/plugins/*/data.json`, and `.trash/`. **Acceptance:** F1.

- [x] 2. Scaffold the plugin in `/plugin` by starting from the Obsidian sample-plugin skeleton (TypeScript + esbuild). Set `manifest.json` fields per F15, `isDesktopOnly: false`. Install `zod`, `vitest`, `esbuild-plugin-text` (or write a 20-line inline text loader). Commit `package.json`, `package-lock.json`, `tsconfig.json`, `esbuild.config.mjs`, `main.ts` (thin — delegates to `src/plugin.ts`), `src/plugin.ts` (registers ribbon + command stub), `styles.css` (empty). Add npm scripts: `build`, `dev`, `typecheck`, `lint`, `test`. **Acceptance:** F2.

- [x] 3. Implement `scripts/install-plugin.sh` that symlinks `plugin/` build output into `mock-vault/.obsidian/plugins/obsidian-auto-tutor/` (idempotent; `ln -sfn`). Add `scripts/setup-mock-vault.sh` that ensures the directory structure. **Acceptance:** running both scripts twice is a no-op; opening `mock-vault` in Obsidian desktop lists the plugin.

- [x] 4. Create `plugin/src/interfaces.ts` verbatim from §10. Add `plugin/src/constants.ts` with `OPENROUTER_BASE_URL`, `STAGES`, default paths. Wire a barrel `plugin/src/index.ts` if useful. **Acceptance:** `npm run typecheck` passes; no unused exports.

- [x] 5. Implement `Validator` in `plugin/src/services/validator.ts` using `zod` schemas that mirror §10 interfaces. Export `validate<T>(schema, data): T` and typed `ValidationError`. Write `tests/unit/validator.test.ts` with ≥ 2 valid and ≥ 2 invalid fixtures per interface. **Acceptance:** `npm test` green.

- [x] 6. Build the Settings tab (`plugin/src/settings.ts`). Fields per F3. Model dropdown starts empty; "Refresh models" button calls `OpenRouterService.listModels()` (stubbed until Task 10, OK to show disabled state with tooltip "Complete Task 10 to enable"). Prompt textareas load bundled defaults from `plugin/src/prompts/*.md` placeholders — create empty files now, content added in Task 13. Persist to `data.json`. **Acceptance:** F3 (model dropdown deferred); settings survive reload.

### Phase 2: Docling service

- [x] 7. Scaffold `docling-service/` with `pyproject.toml` pinning docling + watchdog. Implement `extract.py extract <path>` that runs docling and writes a `.md` with the source-path frontmatter specified in F4 to `../mock-vault/2-Markdown_Sources/<stem>.md`. Content-hash cache in `.docling-cache/<sha256>` avoids re-work. **Acceptance:** dropping a small PDF in `mock-vault/1-Raw_Sources/` and running `python extract.py extract <file>` produces the Markdown once; a second run is a no-op.

- [x] 8. Implement `watch.py` (long-running watchdog observer) delegating to `extract.py`. Log to `~/Library/Logs/auto-tutor-docling.log`. Handle moves, renames, and deletes (delete → remove the paired .md). **Acceptance:** `python watch.py --source mock-vault/1-Raw_Sources --target mock-vault/2-Markdown_Sources`, then drop a file → .md appears within 10 s.

- [x] 9. Write `com.user.auto-tutor.docling.plist`, `install.sh`, `uninstall.sh`, `README.md`. Installer reads `--source` and `--target` args and substitutes them into the plist; launchctl load/unload. Log rotation at 10 MB via plist `StandardErrorPath` + `logrotate`-free approach (custom `log_rotate()` in `watch.py`). **Acceptance:** F4 fully, including a clean uninstall.

### Phase 3: Service layer

- [x] 10. Implement `OpenRouterService` per §12.1 in `plugin/src/services/openrouter.ts`. Use `requestUrl`. JSON-mode via `response_format`. Cache `listModels()` result for 1 h in `data.json` under `settings._modelsCache`. Integration test `tests/integration/openrouter.test.ts` gated on `process.env.OPENROUTER_API_KEY` — skipped otherwise. Wire it to the Settings dropdown from Task 6. **Acceptance:** F5.

- [x] 11. Implement `ContextBuilder` per §12.3. Recursively reads all `.md` files under `/2-Markdown_Sources`, sorts alphabetically, concatenates with the §12.3 separator. Handle empty-sources case per §4.1 (return the `knowledge-only` placeholder string, do NOT throw). Unit tests for ordering, separator, oversize throw, AND the empty-sources path. **Acceptance:** F6.

- [x] 12. Implement `CacheService` per §12.2 and `LockService` per §12.5. Atomic writes via `adapter.write` to `.tmp` then `adapter.rename`. Unit tests: crash-between-rename (use an injected `adapter` mock), stale-lock clearing at 30 min. **Acceptance:** cache tests + lock tests green.

- [x] 13. Author the four bundled prompt files in `plugin/src/prompts/` using §11 text verbatim, including the source-policy language from §4.1 (the "TWO knowledge sources" framing in Stage 1 / 3 / 4; no "only from the source" phrasing anywhere). Wire esbuild text loader so they are importable as strings. Settings tab now displays the defaults and allows overrides (fallback to default when textarea empty). Add `tests/unit/source-policy.test.ts` per §15 that scans the bundled prompt strings for forbidden phrases and asserts the knowledge-only placeholder is substituted correctly by the prompt-composer helpers. **Acceptance:** importing each prompt in a unit test returns the expected string content; overriding in settings persists and is used by the next LLM call (verified via a mock); `source-policy.test.ts` green.

### Phase 4: Pipeline — Stages 0–2

- [x] 14. Implement Stage 0 (`stages/stage0-topic.ts`) + `TopicInputModal` + `TaxonomyView`. Responsive layout: inner = indented tree; cover = one-column + breadcrumb. Use CSS container queries bound on `document.body` width threshold 900 px. Parent-cascade checkbox logic. Writes `stage0.json` on "Continue". **Acceptance:** F7; unit test for cascade logic.

- [x] 15. Implement Stage 1 (`stages/stage1-concepts.ts`). Builds context (grounded or knowledge-only per §4.1), composes the Stage 1 prompt with the scope from Stage 0, calls OpenRouter, validates. Writes `stage1.json`. Progress view shows "Extracting concepts…". Must pass with both the populated `mock-vault/` and the empty `mock-vault-empty/`. **Acceptance:** F8.

- [x] 16. Implement Stage 2 (`stages/stage2-diagnostic.ts`) + `LikertModal`. One-at-a-time concept card with 5 big buttons (≥ 48 px) and a "skip" link. Swipe gesture (left/right) on touch devices advances/reverses. Writes `stage2.json`. **Acceptance:** F9.

- [x] 17. Implement Stage 3 (`stages/stage3-curriculum.ts`) and `SyllabusEditorView`. Render modules as collapsible sections; each lesson is a row with title, difficulty chip, condensed toggle, drag handle. Touch-friendly drag-and-drop (use SortableJS via a tiny wrapper, or implement pointer events). Validate no prerequisite cycles before "Finalize". **Acceptance:** F10.

- [x] 18. Implement `writers/frontmatter.ts`, `writers/markdown.ts`, `writers/navigation.ts`, `writers/moc.ts`. Deterministic slugging (unicode → ascii, lowercase-hyphen). Collision suffixing per F11. Unit tests for every writer including the YAML escaping edge cases in §15. **Acceptance:** all writer tests green.

- [x] 19. Implement `writers/canvas.ts`. Layered grid: modules as columns (x step 400), lessons as rows within a column (y step 240), node size 320×200. Edges per `prerequisiteLessonIds`. Deterministic output (same input → same file byte-for-byte). Unit test. **Acceptance:** canvas output is deterministic and structurally valid.

- [x] 20. Implement Stage 4 (`stages/stage4-generate.ts`) + `ProgressView`. Iterate lessons, call Stage 4 prompt, validate Markdown looks non-empty, assemble the final file via writers from Tasks 18–19. Populate `generation_mode` frontmatter (`grounded` / `augmented` / `knowledge-only`) based on whether the context builder returned a knowledge-only placeholder and whether the LLM populated `sourceRefs` for this lesson's related concepts. Update `stage4.json` after each lesson (resumability). Obtain lock via `LockService`; release on completion or cancel. **Acceptance:** F11.

### Phase 6: Navigation, recovery, canvas

- [x] 21. Generate `Course Index.md` linking every module MOC. Last lesson's "next" points to Course Index. All breadcrumbs round-trip. Unit-test the linkage graph (no dangling wikilinks). **Acceptance:** F12.

- [x] 22. On plugin load, scan `<pluginDir>/cache/` for courses where `CourseMeta.lastStageCompleted < 4`; show a "Resume course: <title>" notice with a one-click resume. Honour the lock. **Acceptance:** F13; manual test: kill Obsidian mid-Stage-4, reopen, resume completes the remaining lessons exactly once.

### Phase 7: Verification hardening

- [x] 23. Add shared test helpers and fixture builders for `grounded`, `augmented`, and `knowledge-only` flows so stage/unit tests can exercise the three modes deterministically. **Acceptance:** tests can construct all three modes without live UI automation.

- [x] 24. Add focused tests around responsive helpers and UI-state logic that do not require Playwright or browser simulation. **Acceptance:** responsive decisions and view-state transitions are covered by standard tests where practical.

- [x] 25. Implement `scripts/verify.sh` to run the standard repo checks (`lint`, `typecheck`, `test`, plus any env-gated integration tests when enabled). **Acceptance:** `scripts/verify.sh` exits 0 on a healthy tree.

- [x] 26. Expand automated test coverage for F1–F13 core logic, especially mode handling, stage validation, caching, navigation, and lock behavior. **Acceptance:** `npm test` and `scripts/verify.sh` provide the main verification path for the project.

### Phase 8: Polish, release

- [x] 27. Mobile polish pass: audit every UI surface at cover-screen viewport; fix touch target sizes; add `loading` and `error` empty states to the progress view. Add a "Cancel generation" button that releases the lock. **Acceptance:** all acceptance criteria in F7–F11 hold on both viewports.

- [x] 28. Sync-conflict pass: atomic writes everywhere (grep the codebase for `adapter.write` followed by a non-rename write), lock checks at the start of Stage 3 and Stage 4, UI for "another device is generating". **Acceptance:** start generation on desktop, simultaneously on another mock vault — second device is refused with a clear error.

- [x] 29. Prepare BRAT release. Fill out `plugin/manifest.json` final fields, write `plugin/versions.json`, add a root `README.md` with installation instructions (BRAT: add repo, install, enable). Add a GitHub Actions workflow `.github/workflows/release.yml` that on tag `v*` builds the plugin and creates a GitHub Release with `main.js`, `manifest.json`, `styles.css`. **Acceptance:** F15 (test locally with `act` or a real dry-run tag `v0.0.1-rc1`).

- [ ] 30. Final verification and release pass: run the full verification workflow, confirm the three modes are covered by tests where relevant, and complete release prep. **Acceptance:** every F* in §14 checked; `scripts/verify.sh` passes; final Release tag pushed.

---

## Notes

- **Model choice:** the user will pick a cheap default via settings. The codebase must not hard-code any specific model except in test fixtures.
- **Token costs:** no budget ceiling per user request. Keep the long-context build efficient (don't re-concatenate sources per-lesson in Stage 4 — cache the concatenation in-memory for the duration of a run).
- **Branching:** single `main` branch; use conventional commits (`feat:`, `fix:`, `test:`). One commit per ticked task is ideal.
- **Secrets:** `.env` in repo root with `OPENROUTER_API_KEY=`, gitignored. Harness and integration tests read from it.
- **What's explicitly out of scope:** RAG, map-reduce ingestion, `/3-Synthesized` population, SRS/spaced repetition, grading, multi-user, cloud sync beyond Obsidian Sync, community-plugin store submission.
- **Ambiguity policy:** when in doubt, prefer the interpretation that keeps mobile working and stage contracts pure. If a choice meaningfully changes the PRD, stop and ask the user rather than guess.
