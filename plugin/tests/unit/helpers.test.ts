import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_ONLY_PLACEHOLDER,
  makeCourseId,
  makeCourseMeta,
  makeScopedTaxonomy,
  makeConcept,
  makeConceptList,
  makeProficiencyMap,
  makeLessonSpec,
  makeModuleSpec,
  makeCurriculum,
  makeGenerationProgress,
  makeStageCache,
  buildGroundedMode,
  buildAugmentedMode,
  buildKnowledgeOnlyMode,
  buildAllModes,
  classifyRunMode,
  isKnowledgeOnlyContext,
  hasGroundedConcepts,
  allConceptsGrounded,
  someConceptsAugmented,
} from '../helpers';

describe('test-helpers', () => {
  describe('KNOWLEDGE_ONLY_PLACEHOLDER', () => {
    it('is the correct literal string', () => {
      expect(KNOWLEDGE_ONLY_PLACEHOLDER).toBe('(no user-provided sources — rely on your general knowledge of the topic)');
    });
  });

  describe('makeCourseId', () => {
    it('generates a string with default seed', () => {
      const id = makeCourseId();
      expect(typeof id).toBe('string');
      expect(id).toContain('test-');
    });

    it('generates a string with custom seed', () => {
      const id = makeCourseId('ml');
      expect(id).toContain('ml-');
    });
  });

  describe('makeCourseMeta', () => {
    it('creates valid CourseMeta', () => {
      const meta = makeCourseMeta();
      expect(meta.courseId).toBeTruthy();
      expect(meta.seedTopic).toBe('Machine Learning');
      expect(meta.lastStageCompleted).toBeNull();
    });

    it('applies overrides', () => {
      const meta = makeCourseMeta({ seedTopic: 'Linear Algebra', lastStageCompleted: 2 as const });
      expect(meta.seedTopic).toBe('Linear Algebra');
      expect(meta.lastStageCompleted).toBe(2);
    });
  });

  describe('makeScopedTaxonomy', () => {
    it('creates valid ScopedTaxonomy', () => {
      const taxonomy = makeScopedTaxonomy();
      expect(taxonomy.courseId).toBeTruthy();
      expect(taxonomy.root.children.length).toBeGreaterThan(0);
      expect(taxonomy.selectedIds.length).toBeGreaterThan(0);
    });
  });

  describe('makeConcept', () => {
    it('creates valid Concept', () => {
      const concept = makeConcept();
      expect(concept.id).toBe('supervised-learning');
      expect(concept.name).toBe('Supervised Learning');
      expect(concept.sourceRefs).toEqual([]);
    });

    it('applies overrides including sourceRefs', () => {
      const concept = makeConcept({ id: 'new-id', sourceRefs: ['intro-to-ml.md'] });
      expect(concept.id).toBe('new-id');
      expect(concept.sourceRefs).toEqual(['intro-to-ml.md']);
    });
  });

  describe('makeConceptList', () => {
    it('creates ConceptList with default 5 concepts', () => {
      const list = makeConceptList();
      expect(list.concepts.length).toBe(5);
      expect(list.courseId).toBeTruthy();
    });
  });

  describe('makeProficiencyMap', () => {
    it('creates valid ProficiencyMap', () => {
      const map = makeProficiencyMap();
      expect(map.courseId).toBeTruthy();
      expect(Object.keys(map.scores).length).toBe(5);
      expect(Object.values(map.scores).every(v => v >= 1 && v <= 5)).toBe(true);
    });
  });

  describe('makeLessonSpec', () => {
    it('creates valid LessonSpec', () => {
      const lesson = makeLessonSpec();
      expect(lesson.id).toBe('lesson-1');
      expect(lesson.difficulty).toBe('intro');
      expect(lesson.condensed).toBe(false);
    });
  });

  describe('makeModuleSpec', () => {
    it('creates valid ModuleSpec with lessons', () => {
      const module = makeModuleSpec();
      expect(module.id).toBe('module-1');
      expect(module.lessons.length).toBe(2);
    });
  });

  describe('makeCurriculum', () => {
    it('creates valid Curriculum with modules', () => {
      const curriculum = makeCurriculum();
      expect(curriculum.title).toBe('Machine Learning Fundamentals');
      expect(curriculum.modules.length).toBe(2);
      expect(curriculum.modules[0].lessons.length).toBe(2);
    });
  });

  describe('makeGenerationProgress', () => {
    it('creates valid GenerationProgress', () => {
      const progress = makeGenerationProgress();
      expect(progress.courseId).toBeTruthy();
      expect(progress.lessons.length).toBe(2);
      expect(progress.startedAt).toBeTruthy();
    });
  });

  describe('makeStageCache', () => {
    it('creates valid StageCache', () => {
      const cache = makeStageCache();
      expect(cache.meta).toBeTruthy();
    });
  });

  describe('buildGroundedMode', () => {
    it('creates grounded fixtures with non-empty sourceRefs', () => {
      const fixtures = buildGroundedMode();
      expect(fixtures.mode).toBe('grounded');
      expect(fixtures.contextText).toContain('intro-to-ml.md');
      expect(fixtures.files).toEqual(['intro-to-ml.md', 'linear-algebra-primer.md']);
      expect(fixtures.conceptList.concepts.some(c => c.sourceRefs.length > 0)).toBe(true);
    });
  });

  describe('buildAugmentedMode', () => {
    it('creates augmented fixtures with mixed sourceRefs', () => {
      const fixtures = buildAugmentedMode();
      expect(fixtures.mode).toBe('augmented');
      expect(fixtures.contextText).toContain('intro-to-ml.md');
      expect(fixtures.files).toEqual(['intro-to-ml.md']);
      const hasGrounded = fixtures.conceptList.concepts.some(c => c.sourceRefs.length > 0);
      const hasKnowledgeOnly = fixtures.conceptList.concepts.some(c => c.sourceRefs.length === 0);
      expect(hasGrounded).toBe(true);
      expect(hasKnowledgeOnly).toBe(true);
    });
  });

  describe('buildKnowledgeOnlyMode', () => {
    it('creates knowledge-only fixtures with empty sourceRefs', () => {
      const fixtures = buildKnowledgeOnlyMode();
      expect(fixtures.mode).toBe('knowledge-only');
      expect(fixtures.contextText).toBe(KNOWLEDGE_ONLY_PLACEHOLDER);
      expect(fixtures.files).toEqual([]);
      expect(fixtures.conceptList.concepts.every(c => c.sourceRefs.length === 0)).toBe(true);
    });
  });

  describe('buildAllModes', () => {
    it('creates all three mode fixtures', () => {
      const all = buildAllModes();
      expect(all.grounded.mode).toBe('grounded');
      expect(all.augmented.mode).toBe('augmented');
      expect(all.knowledgeOnly.mode).toBe('knowledge-only');
    });
  });

  describe('classifyRunMode', () => {
    it('classifies knowledge-only when context is placeholder', () => {
      const { conceptList } = buildKnowledgeOnlyMode();
      const mode = classifyRunMode(KNOWLEDGE_ONLY_PLACEHOLDER, conceptList);
      expect(mode).toBe('knowledge-only');
    });

    it('classifies grounded when all concepts have sourceRefs', () => {
      const { conceptList } = buildGroundedMode();
      const contextText = 'some source content';
      const mode = classifyRunMode(contextText, conceptList);
      expect(mode).toBe('grounded');
    });

    it('classifies augmented when some concepts have sourceRefs', () => {
      const { conceptList } = buildAugmentedMode();
      const contextText = 'some source content';
      const mode = classifyRunMode(contextText, conceptList);
      expect(mode).toBe('augmented');
    });
  });

  describe('isKnowledgeOnlyContext', () => {
    it('returns true for placeholder', () => {
      expect(isKnowledgeOnlyContext(KNOWLEDGE_ONLY_PLACEHOLDER)).toBe(true);
    });

    it('returns false for actual content', () => {
      expect(isKnowledgeOnlyContext('some source content')).toBe(false);
    });
  });

  describe('hasGroundedConcepts', () => {
    it('returns true when some concepts have sourceRefs', () => {
      const { conceptList } = buildGroundedMode();
      expect(hasGroundedConcepts(conceptList)).toBe(true);
    });

    it('returns false when no concepts have sourceRefs', () => {
      const { conceptList } = buildKnowledgeOnlyMode();
      expect(hasGroundedConcepts(conceptList)).toBe(false);
    });
  });

  describe('allConceptsGrounded', () => {
    it('returns true when all concepts have sourceRefs', () => {
      const { conceptList } = buildGroundedMode();
      expect(allConceptsGrounded(conceptList)).toBe(true);
    });

    it('returns false when some concepts lack sourceRefs', () => {
      const { conceptList } = buildAugmentedMode();
      expect(allConceptsGrounded(conceptList)).toBe(false);
    });
  });

  describe('someConceptsAugmented', () => {
    it('returns true when some concepts have sourceRefs and some do not', () => {
      const { conceptList } = buildAugmentedMode();
      expect(someConceptsAugmented(conceptList)).toBe(true);
    });

    it('returns false when all concepts have sourceRefs', () => {
      const { conceptList } = buildGroundedMode();
      expect(someConceptsAugmented(conceptList)).toBe(false);
    });

    it('returns false when no concepts have sourceRefs', () => {
      const { conceptList } = buildKnowledgeOnlyMode();
      expect(someConceptsAugmented(conceptList)).toBe(false);
    });
  });
});
