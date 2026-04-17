import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_ONLY_PLACEHOLDER,
  makeConceptList,
  makeCurriculum,
  makeScopedTaxonomy,
} from '../helpers';

vi.mock('../../src/ui/conflict-modal', () => ({
  showConflictModal: vi.fn(),
}));

describe('stage runner return contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runStage1 resolves the generated concept list on success', async () => {
    const { runStage1 } = await import('../../src/stages/stage1-concepts');
    const conceptList = makeConceptList({
      courseId: 'course-stage1',
      concepts: Array.from({ length: 15 }, (_, index) => ({
        id: `concept-${index + 1}`,
        name: `Concept ${index + 1}`,
        definition: `Definition ${index + 1}`,
        sourceRefs: [],
      })),
    });

    const result = await runStage1({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify(conceptList),
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as never,
      contextBuilder: {
        buildContext: vi.fn().mockResolvedValue({
          text: '(no user-provided sources — rely on your general knowledge of the topic)',
        }),
      } as never,
      taxonomy: makeScopedTaxonomy({ courseId: 'course-stage1' }),
      courseId: 'course-stage1',
      model: 'test-model',
      modelContextLength: 4096,
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual(conceptList);
  });

  it('runStage1 resolves null and reports the error on failure', async () => {
    const { runStage1 } = await import('../../src/stages/stage1-concepts');
    const onError = vi.fn();

    const result = await runStage1({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockRejectedValue(new Error('llm offline')),
      } as never,
      contextBuilder: {
        buildContext: vi.fn().mockResolvedValue({
          text: '(no user-provided sources — rely on your general knowledge of the topic)',
        }),
      } as never,
      taxonomy: makeScopedTaxonomy({ courseId: 'course-stage1-fail' }),
      courseId: 'course-stage1-fail',
      model: 'test-model',
      modelContextLength: 4096,
      onComplete: vi.fn(),
      onError,
    });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('runStage4 resolves progress on success', async () => {
    const { runStage4 } = await import('../../src/stages/stage4-generate');
    const curriculum = makeCurriculum({
      courseId: 'course-stage4',
      modules: [
        {
          id: 'module-1',
          title: 'Introduction',
          lessons: [
            {
              id: 'lesson-1',
              title: 'What is Machine Learning?',
              summary: 'An introduction.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    });
    const onComplete = vi.fn();
    const onError = vi.fn();

    const result = await runStage4({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockResolvedValue({
          content: `# What is Machine Learning?\n\n${'word '.repeat(420)}\n\n> [!question]\n> What is one use case?\n> Answer: Prediction.`,
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as never,
      courseId: 'course-stage4',
      curriculum,
      concepts: makeConceptList().concepts,
      contextText: KNOWLEDGE_ONLY_PLACEHOLDER,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      writeLesson: vi.fn().mockResolvedValue(undefined),
      writeMoc: vi.fn().mockResolvedValue(undefined),
      writeCanvas: vi.fn().mockResolvedValue(undefined),
      writeCourseIndex: vi.fn().mockResolvedValue(undefined),
      onProgress: vi.fn(),
      onComplete,
      onError,
    });

    expect(result).not.toBeNull();
    expect(result?.courseId).toBe('course-stage4');
    expect(result?.completedAt).toEqual(expect.any(String));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('runStage3 refuses to start when another device holds the generation lock', async () => {
    const { runStage3 } = await import('../../src/stages/stage3-curriculum');
    const onComplete = vi.fn();
    const onError = vi.fn();

    const result = await runStage3({
      app: {} as never,
      openRouter: {
        chat: vi.fn(),
      } as never,
      contextBuilder: {
        buildContext: vi.fn(),
      } as never,
      lockService: {
        isLockedByAnother: vi.fn().mockResolvedValue({
          locked: true,
          info: {
            courseId: 'other-course',
            deviceName: 'desktop-2',
            startedAt: Date.now(),
          },
        }),
      } as never,
      taxonomy: makeScopedTaxonomy({ courseId: 'course-stage3' }),
      concepts: makeConceptList({ courseId: 'course-stage3' }),
      proficiency: {
        courseId: 'course-stage3',
        scores: {},
      },
      courseId: 'course-stage3',
      model: 'test-model',
      modelContextLength: 4096,
      onComplete,
      onError,
    });

    expect(result).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('runStage4 resolves null and reports the error on failure', async () => {
    const { runStage4 } = await import('../../src/stages/stage4-generate');
    const onComplete = vi.fn();
    const onError = vi.fn();

    const result = await runStage4({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockRejectedValue(new Error('llm offline')),
      } as never,
      courseId: 'course-stage4-fail',
      curriculum: makeCurriculum({ courseId: 'course-stage4-fail' }),
      concepts: makeConceptList().concepts,
      contextText: KNOWLEDGE_ONLY_PLACEHOLDER,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn().mockResolvedValue(null),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      writeLesson: vi.fn().mockResolvedValue(undefined),
      writeMoc: vi.fn().mockResolvedValue(undefined),
      writeCanvas: vi.fn().mockResolvedValue(undefined),
      writeCourseIndex: vi.fn().mockResolvedValue(undefined),
      onProgress: vi.fn(),
      onComplete,
      onError,
    });

    expect(result).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
