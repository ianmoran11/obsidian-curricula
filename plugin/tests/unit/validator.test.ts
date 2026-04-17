import { describe, it, expect } from 'vitest';
import { validate, validators, ValidationError } from '../../src/services/validator';
import type { Concept, ConceptList, Curriculum, CourseMeta, LikertScore, ProficiencyMap, ScopedTaxonomy, TaxonomyNode } from '../../src/interfaces';

function assertThrowsValidation(fn: () => void): void {
  try {
    fn();
    expect.fail('Expected ValidationError to be thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
  }
}

describe('validator', () => {
  describe('CourseMeta', () => {
    const validCourseMeta = {
      courseId: 'ml-basics-1234567890',
      seedTopic: 'Machine Learning Basics',
      createdAt: '2024-01-15T10:30:00Z',
      lastStageCompleted: 2,
      modelUsed: 'anthropic/claude-3.5-haiku',
    };

    it('accepts valid CourseMeta', () => {
      const result = validate(validators.courseMeta, validCourseMeta);
      expect(result).toEqual(validCourseMeta);
    });

    it('accepts null lastStageCompleted', () => {
      const result = validate(validators.courseMeta, { ...validCourseMeta, lastStageCompleted: null });
      expect(result.lastStageCompleted).toBeNull();
    });

    it('rejects invalid lastStageCompleted', () => {
      assertThrowsValidation(() => validate(validators.courseMeta, { ...validCourseMeta, lastStageCompleted: 5 }));
    });

    it('rejects missing required field', () => {
      assertThrowsValidation(() => validate(validators.courseMeta, { seedTopic: 'ML', createdAt: '2024', lastStageCompleted: null, modelUsed: 'model' }));
    });
  });

  describe('TaxonomyNode', () => {
    const validNode: TaxonomyNode = {
      id: 'ml.supervised.classification',
      title: 'Classification',
      description: 'Predicting categorical outcomes',
      children: [
        { id: 'ml.supervised.classification.binary', title: 'Binary', children: [] },
        { id: 'ml.supervised.classification.multiclass', title: 'Multiclass', children: [] },
      ],
    };

    it('accepts valid TaxonomyNode', () => {
      const result = validate(validators.taxonomyNode, validNode);
      expect(result.id).toBe('ml.supervised.classification');
      expect(result.children.length).toBe(2);
    });

    it('accepts node without description', () => {
      const result = validate(validators.taxonomyNode, { id: 'ml', title: 'ML', children: [] });
      expect(result.description).toBeUndefined();
    });

    it('rejects node with non-array children', () => {
      assertThrowsValidation(() => validate(validators.taxonomyNode, { id: 'ml', title: 'ML', children: 'not array' }));
    });

    it('rejects node with missing id', () => {
      assertThrowsValidation(() => validate(validators.taxonomyNode, { title: 'ML', children: [] }));
    });
  });

  describe('Concept', () => {
    const validConcept: Concept = {
      id: 'supervised-learning',
      name: 'Supervised Learning',
      definition: 'Learning from labeled training data to predict outputs for new inputs.',
      sourceRefs: ['intro-to-ml.md'],
    };

    it('accepts valid Concept', () => {
      const result = validate(validators.concept, validConcept);
      expect(result.id).toBe('supervised-learning');
      expect(result.sourceRefs).toEqual(['intro-to-ml.md']);
    });

    it('accepts Concept with empty sourceRefs', () => {
      const result = validate(validators.concept, { ...validConcept, sourceRefs: [] });
      expect(result.sourceRefs).toEqual([]);
    });

    it('rejects definition over 200 chars', () => {
      const longDef = { ...validConcept, definition: 'a'.repeat(201) };
      assertThrowsValidation(() => validate(validators.concept, longDef));
    });

    it('rejects Concept with missing name', () => {
      assertThrowsValidation(() => validate(validators.concept, { id: 'test', definition: 'short', sourceRefs: [] }));
    });
  });

  describe('ConceptList', () => {
    const validConceptList: ConceptList = {
      courseId: 'ml-basics-123',
      concepts: [
        { id: 'supervised-learning', name: 'Supervised Learning', definition: 'Learning from labeled data.', sourceRefs: [] },
        { id: 'unsupervised-learning', name: 'Unsupervised Learning', definition: 'Finding structure in unlabeled data.', sourceRefs: [] },
      ],
    };

    it('accepts valid ConceptList', () => {
      const result = validate(validators.conceptList, validConceptList);
      expect(result.concepts.length).toBe(2);
    });

    it('accepts ConceptList with any number of concepts', () => {
      // Schema does not enforce 15-40; that's a runtime/LLM requirement
      const shortList = { courseId: 'ml', concepts: [{ id: 'a', name: 'A', definition: 'Short', sourceRefs: [] }] };
      const result = validate(validators.conceptList, shortList);
      expect(result.concepts.length).toBe(1);
    });

    it('rejects ConceptList with missing concepts', () => {
      assertThrowsValidation(() => validate(validators.conceptList, { courseId: 'ml' }));
    });
  });

  describe('LikertScore', () => {
    it('accepts values 1-5', () => {
      for (const score of [1, 2, 3, 4, 5] as LikertScore[]) {
        const result = validate(validators.likertScore, score);
        expect(result).toBe(score);
      }
    });

    it('rejects 0', () => {
      assertThrowsValidation(() => validate(validators.likertScore, 0));
    });

    it('rejects 6', () => {
      assertThrowsValidation(() => validate(validators.likertScore, 6));
    });
  });

  describe('ProficiencyMap', () => {
    const validProficiencyMap: ProficiencyMap = {
      courseId: 'ml-basics-123',
      scores: {
        'supervised-learning': 3,
        'unsupervised-learning': 2,
        'reinforcement-learning': 1,
      },
    };

    it('accepts valid ProficiencyMap', () => {
      const result = validate(validators.proficiencyMap, validProficiencyMap);
      expect(result.scores['supervised-learning']).toBe(3);
    });

    it('rejects invalid Likert value in scores', () => {
      const badMap = { courseId: 'ml', scores: { concept: 6 as any } };
      assertThrowsValidation(() => validate(validators.proficiencyMap, badMap));
    });
  });

  describe('Curriculum', () => {
    const validCurriculum: Curriculum = {
      courseId: 'ml-basics-123',
      title: 'Machine Learning Fundamentals',
      modules: [
        {
          id: 'module-1',
          title: 'Introduction',
          lessons: [
            {
              id: 'lesson-1',
              title: 'What is ML?',
              summary: 'An introduction to machine learning concepts.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    };

    it('accepts valid Curriculum', () => {
      const result = validate(validators.curriculum, validCurriculum);
      expect(result.modules.length).toBe(1);
    });

    it('rejects Curriculum missing title', () => {
      const bad = { courseId: 'ml', modules: [] };
      assertThrowsValidation(() => validate(validators.curriculum, bad));
    });

    it('rejects lesson with invalid difficulty', () => {
      const bad = { ...validCurriculum, modules: [{ id: 'm', title: 'M', lessons: [{ id: 'l', title: 'L', summary: 'S', prerequisiteLessonIds: [], relatedConceptIds: [], difficulty: 'expert' as any, condensed: false }] }] };
      assertThrowsValidation(() => validate(validators.curriculum, bad));
    });
  });
});