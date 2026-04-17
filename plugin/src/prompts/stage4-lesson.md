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