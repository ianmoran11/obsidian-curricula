import { describe, it, expect } from 'vitest';
import {
  STAGE0_PROMPT,
  STAGE1_PROMPT,
  STAGE3_PROMPT,
  STAGE4_PROMPT,
  composeStage1Prompt,
  composeStage3Prompt,
  composeStage4Prompt,
  containsForbiddenPhrases,
  isKnowledgeOnlyPlaceholder,
  FORBIDDEN_PHRASES,
} from '../../src/prompts/index';

const KNOWLEDGE_ONLY_PLACEHOLDER = '(no user-provided sources — rely on your general knowledge of the topic)';

describe('source-policy', () => {
  describe('bundled prompts have no forbidden phrases', () => {
    const allPrompts = [STAGE0_PROMPT, STAGE1_PROMPT, STAGE3_PROMPT, STAGE4_PROMPT];

    for (const prompt of allPrompts) {
      it(`prompt does not contain forbidden phrases`, () => {
        const found = containsForbiddenPhrases(prompt);
        expect(found, `Found forbidden phrases: ${found.join(', ')}`).toHaveLength(0);
      });
    }
  });

  describe('Stage 1 prompt composer substitutes knowledge-only placeholder', () => {
    it('substitutes placeholder when contextText is empty', () => {
      const result = composeStage1Prompt(['node1', 'node2'], '');
      expect(result).toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
      expect(result).not.toContain('{{contextText}}');
    });

    it('substitutes placeholder when contextText is whitespace only', () => {
      const result = composeStage1Prompt(['node1'], '   ');
      expect(result).toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
    });

    it('uses provided contextText when non-empty', () => {
      const ctx = 'This is some source content about machine learning.';
      const result = composeStage1Prompt(['node1'], ctx);
      expect(result).toContain(ctx);
      expect(result).not.toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
    });
  });

  describe('Stage 3 prompt composer substitutes knowledge-only placeholder', () => {
    it('substitutes placeholder when contextText is empty', () => {
      const concepts = [{ id: 'c1', name: 'Concept', definition: 'Def', sourceRefs: [] }];
      const profMap = { courseId: 'c1', scores: { c1: 3 as const } };
      const result = composeStage3Prompt(['node1'], concepts, profMap, '');
      expect(result).toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
      expect(result).not.toContain('{{contextText}}');
    });

    it('uses provided contextText when non-empty', () => {
      const concepts = [{ id: 'c1', name: 'Concept', definition: 'Def', sourceRefs: [] }];
      const profMap = { courseId: 'c1', scores: { c1: 3 as const } };
      const ctx = 'Source content here.';
      const result = composeStage3Prompt(['node1'], concepts, profMap, ctx);
      expect(result).toContain(ctx);
      expect(result).not.toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
    });
  });

  describe('Stage 4 prompt composer substitutes knowledge-only placeholder', () => {
    it('substitutes placeholder when contextText is empty', () => {
      const lesson = { id: 'l1', title: 'Lesson', summary: 'Summary', prerequisiteLessonIds: [], relatedConceptIds: ['c1'], difficulty: 'intro' as const, condensed: false };
      const concepts = [{ id: 'c1', name: 'Concept', definition: 'Def', sourceRefs: [] }];
      const result = composeStage4Prompt(lesson, concepts, '');
      expect(result).toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
      expect(result).not.toContain('{{contextText}}');
    });

    it('uses provided contextText when non-empty', () => {
      const lesson = { id: 'l1', title: 'Lesson', summary: 'Summary', prerequisiteLessonIds: [], relatedConceptIds: ['c1'], difficulty: 'intro' as const, condensed: false };
      const concepts = [{ id: 'c1', name: 'Concept', definition: 'Def', sourceRefs: [] }];
      const ctx = 'Lesson source content.';
      const result = composeStage4Prompt(lesson, concepts, ctx);
      expect(result).toContain(ctx);
      expect(result).not.toContain(KNOWLEDGE_ONLY_PLACEHOLDER);
    });
  });

  describe('containsForbiddenPhrases', () => {
    it('detects forbidden phrases', () => {
      expect(containsForbiddenPhrases('only from the source text here')).toContain('only from the source');
      expect(containsForbiddenPhrases('refuse if no sources given')).toContain('refuse if no');
    });

    it('returns empty for clean prompts', () => {
      expect(containsForbiddenPhrases('This is a clean prompt without forbidden phrases.')).toHaveLength(0);
    });
  });

  describe('isKnowledgeOnlyPlaceholder', () => {
    it('returns true for the placeholder', () => {
      expect(isKnowledgeOnlyPlaceholder(KNOWLEDGE_ONLY_PLACEHOLDER)).toBe(true);
    });

    it('returns false for other strings', () => {
      expect(isKnowledgeOnlyPlaceholder('some actual sources')).toBe(false);
      expect(isKnowledgeOnlyPlaceholder('')).toBe(false);
    });
  });

  describe('importing prompts returns expected content', () => {
    it('stage 0 prompt is non-empty', () => {
      expect(STAGE0_PROMPT.length).toBeGreaterThan(0);
      expect(STAGE0_PROMPT).toContain('{{seedTopic}}');
    });

    it('stage 1 prompt is non-empty', () => {
      expect(STAGE1_PROMPT.length).toBeGreaterThan(0);
      expect(STAGE1_PROMPT).toContain('{{selectedNodeIds}}');
      expect(STAGE1_PROMPT).toContain('{{contextText}}');
    });

    it('stage 3 prompt is non-empty', () => {
      expect(STAGE3_PROMPT.length).toBeGreaterThan(0);
      expect(STAGE3_PROMPT).toContain('{{concepts}}');
    });

    it('stage 4 prompt is non-empty', () => {
      expect(STAGE4_PROMPT.length).toBeGreaterThan(0);
      expect(STAGE4_PROMPT).toContain('{{lesson}}');
      expect(STAGE4_PROMPT).toContain('{{relatedConcepts}}');
    });
  });
});