import type { Concept, ProficiencyMap, LessonSpec } from '../interfaces';

export const STAGE0_PROMPT = `You are a curriculum designer. Given a seed topic, produce a hierarchical taxonomy of the subject as JSON. Three levels max: area → sub-area → leaf topic. Each node has a stable dot-notation id, a title ≤ 60 chars, and an optional one-line description.

Output JSON EXACTLY matching:
{ "root": { "id": "...", "title": "...", "description": "...", "children": [ ... ] } }

Seed topic: {{seedTopic}}

Return JSON only. No prose, no markdown fences.`;

export const STAGE1_PROMPT = `You extract foundational concepts for a learning curriculum, filtered by a user-defined scope.

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
- sourceRefs lists filenames from USER-PROVIDED SOURCES that directly support the concept. \`sourceRefs: []\` is valid and expected when the concept comes from general knowledge or when no sources were provided.
- Do NOT fabricate filenames. Only list files that actually appeared in USER-PROVIDED SOURCES.
- Ids are lowercase-hyphen slugs, unique within the list.
- Do not include concepts outside the scope.
- Return JSON only.`;

export const STAGE3_PROMPT = `You are designing a personalised syllabus.

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
- Return JSON only.`;

export const STAGE4_PROMPT = `Write one lesson in Obsidian-flavoured Markdown.

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
- Return raw Markdown only, no code fences around the whole file.`;

const KNOWLEDGE_ONLY_PLACEHOLDER = '(no user-provided sources — rely on your general knowledge of the topic)';

export function composeStage0Prompt(seedTopic: string, template = STAGE0_PROMPT): string {
  return template.replace('{{seedTopic}}', seedTopic);
}

export function composeStage1Prompt(
  selectedNodeIds: string[],
  contextText: string,
  template = STAGE1_PROMPT
): string {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER;
  }
  return template
    .replace('{{selectedNodeIds}}', selectedNodeIds.join(', '))
    .replace('{{contextText}}', context);
}

export function composeStage3Prompt(
  selectedNodeIds: string[],
  concepts: Concept[],
  proficiencyMap: ProficiencyMap,
  contextText: string,
  template = STAGE3_PROMPT
): string {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER;
  }
  return template
    .replace('{{selectedNodeIds}}', selectedNodeIds.join(', '))
    .replace('{{concepts}}', JSON.stringify(concepts))
    .replace('{{proficiencyMap}}', JSON.stringify(proficiencyMap.scores))
    .replace('{{contextText}}', context);
}

export function composeStage4Prompt(
  lesson: LessonSpec,
  relatedConcepts: Concept[],
  contextText: string,
  template = STAGE4_PROMPT
): string {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER;
  }
  const conceptsWithDefs = relatedConcepts
    .filter(c => lesson.relatedConceptIds.includes(c.id))
    .map(c => `- ${c.name}: ${c.definition}`)
    .join('\n');
  return template
    .replace('{{lesson}}', JSON.stringify(lesson))
    .replace('{{relatedConcepts}}', conceptsWithDefs)
    .replace('{{contextText}}', context);
}

export const FORBIDDEN_PHRASES = [
  'only from the source',
  'only use the provided text',
  'refuse if no',
  'cannot answer without',
  'must cite',
  'ground yourself in the provided text',
];

export function containsForbiddenPhrases(prompt: string): string[] {
  const found: string[] = [];
  const lower = prompt.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  return found;
}

export function isKnowledgeOnlyPlaceholder(text: string): boolean {
  return text === KNOWLEDGE_ONLY_PLACEHOLDER;
}
