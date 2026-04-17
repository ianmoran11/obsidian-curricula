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