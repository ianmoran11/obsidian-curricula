import { describe, expect, it, vi } from 'vitest';
import { KNOWLEDGE_ONLY_PLACEHOLDER, buildGroundedMode, buildKnowledgeOnlyMode, makeCurriculum } from '../helpers';
import {
  GenerationCancelledError,
  runStage4,
  Stage4Runner,
} from '../../src/stages/stage4-generate';

function buildLessonMarkdown(title: string, wordCount: number): string {
  const body = Array.from({ length: wordCount }, (_, index) => `concept${index + 1}`).join(' ');
  return `# ${title}

${body}

Worked example: apply the idea to a small dataset and explain each step clearly.

> [!question]
> What should the learner remember?
> Answer: Focus on the central idea and when to apply it.`;
}

describe('stage4 generation', () => {
  it('writes grounded lesson files with frontmatter, breadcrumb, navigation, and source refs', async () => {
    const grounded = buildGroundedMode();
    const curriculum = makeCurriculum({
      courseId: grounded.conceptList.courseId,
      modules: [
        {
          id: 'module-1',
          title: 'Foundations',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Supervised Learning Basics',
              summary: 'Learn the core idea.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
            {
              id: 'lesson-2',
              title: 'Classification in Practice',
              summary: 'Use labels to predict classes.',
              prerequisiteLessonIds: ['lesson-1'],
              relatedConceptIds: ['classification'],
              difficulty: 'intermediate',
              condensed: false,
            },
          ],
        },
      ],
    });

    const writes = new Map<string, string>();
    const progressUpdates: string[] = [];

    const openRouter = {
      chat: vi.fn().mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
        const prompt = messages[0]?.content ?? '';
        const titleMatch = prompt.match(/"title":"([^"]+)"/);
        const title = titleMatch?.[1] ?? 'Untitled Lesson';
        return {
          content: buildLessonMarkdown(title, 430),
          usage: { inputTokens: 10, outputTokens: 20 },
        };
      }),
    };

    const result = await runStage4({
      app: {} as never,
      openRouter: openRouter as never,
      courseId: curriculum.courseId,
      curriculum,
      concepts: grounded.conceptList.concepts,
      contextText: grounded.contextText,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      writeLesson: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeMoc: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeCanvas: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeCourseIndex: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      onProgress: vi.fn(async (progress) => {
        progressUpdates.push(progress.lessons.map((lesson) => lesson.status).join(','));
      }),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).not.toBeNull();
    expect(openRouter.chat).toHaveBeenCalledTimes(2);
    expect(progressUpdates.length).toBeGreaterThanOrEqual(4);

    const lessonPath = '4-Curriculum/foundations/supervised-learning-basics.md';
    const lessonContent = writes.get(lessonPath);
    expect(lessonContent).toContain('status: unread');
    expect(lessonContent).toContain('lessonId: lesson-1');
    expect(lessonContent).toContain('moduleId: module-1');
    expect(lessonContent).toContain('sourceRefs: ["intro-to-ml.md"]');
    expect(lessonContent).toContain('generation_mode: grounded');
    expect(lessonContent).toContain(
      '[[4-Curriculum/Course Index|Course Index]] > [[4-Curriculum/foundations/foundations MOC|Foundations]]'
    );
    expect(lessonContent).toContain('# Supervised Learning Basics');
    expect(lessonContent).toContain('> [!question]');
    expect(lessonContent).toContain('Next:');
    expect(lessonContent).not.toContain('This lesson covers');

    const secondLessonContent = writes.get('4-Curriculum/foundations/classification-in-practice.md');
    expect(secondLessonContent).toContain('Previous:');

    expect(writes.get('4-Curriculum/foundations/foundations MOC.md')).toContain('## Lessons');
    expect(writes.get('4-Curriculum/Course Index.md')).toContain('## Modules');
    expect(writes.get('4-Curriculum/course.canvas')).toContain('"nodes"');
    expect(result?.lessons[0]?.sourceRefs).toEqual(['intro-to-ml.md']);
    expect(result?.lessons[0]?.status).toBe('written');
    expect(result?.completedAt).toEqual(expect.any(String));
  });

  it('writes knowledge-only lessons with empty source refs and knowledge-only mode', async () => {
    const knowledgeOnly = buildKnowledgeOnlyMode();
    const curriculum = makeCurriculum({
      courseId: knowledgeOnly.conceptList.courseId,
      modules: [
        {
          id: 'module-1',
          title: 'Foundations',
          lessons: [
            {
              id: 'lesson-1',
              title: 'What is Machine Learning?',
              summary: 'Introductory lesson.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    });

    const writes = new Map<string, string>();

    const result = await runStage4({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockResolvedValue({
          content: buildLessonMarkdown('What is Machine Learning?', 420),
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as never,
      courseId: curriculum.courseId,
      curriculum,
      concepts: knowledgeOnly.conceptList.concepts,
      contextText: KNOWLEDGE_ONLY_PLACEHOLDER,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      writeLesson: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeMoc: vi.fn(async () => undefined),
      writeCanvas: vi.fn(async () => undefined),
      writeCourseIndex: vi.fn(async () => undefined),
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    const lessonContent = writes.get('4-Curriculum/foundations/what-is-machine-learning.md');
    expect(result).not.toBeNull();
    expect(lessonContent).toContain('sourceRefs: []');
    expect(lessonContent).toContain('generation_mode: knowledge-only');
    expect(lessonContent).toContain('# What is Machine Learning?');
    expect(lessonContent).not.toContain('no source was given');
    expect(result?.lessons[0]?.sourceRefs).toEqual([]);
  });

  it('writes breadcrumb and prev-next links using slugged file paths for duplicate lesson titles', async () => {
    const grounded = buildGroundedMode();
    const curriculum = makeCurriculum({
      courseId: grounded.conceptList.courseId,
      modules: [
        {
          id: 'module-1',
          title: 'Foundations & Setup',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Intro / Setup',
              summary: 'First pass.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
            {
              id: 'lesson-2',
              title: 'Intro / Setup',
              summary: 'Second pass.',
              prerequisiteLessonIds: ['lesson-1'],
              relatedConceptIds: ['classification'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    });

    const writes = new Map<string, string>();
    const openRouter = {
      chat: vi.fn().mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
        const prompt = messages[0]?.content ?? '';
        const titleMatch = prompt.match(/"title":"([^"]+)"/);
        const title = titleMatch?.[1] ?? 'Untitled Lesson';
        return {
          content: buildLessonMarkdown(title, 430),
          usage: { inputTokens: 10, outputTokens: 20 },
        };
      }),
    };

    await runStage4({
      app: {} as never,
      openRouter: openRouter as never,
      courseId: curriculum.courseId,
      curriculum,
      concepts: grounded.conceptList.concepts,
      contextText: grounded.contextText,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      writeLesson: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeMoc: vi.fn(async () => undefined),
      writeCanvas: vi.fn(async () => undefined),
      writeCourseIndex: vi.fn(async () => undefined),
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    const firstLesson = writes.get('4-Curriculum/foundations-setup/intro-setup.md');
    const secondLesson = writes.get('4-Curriculum/foundations-setup/intro-setup-2.md');

    expect(firstLesson).toContain(
      '[[4-Curriculum/Course Index|Course Index]] > [[4-Curriculum/foundations-setup/foundations-setup MOC|Foundations & Setup]]'
    );
    expect(firstLesson).toContain('[[4-Curriculum/foundations-setup/intro-setup-2|Intro / Setup]]');
    expect(secondLesson).toContain('[[4-Curriculum/foundations-setup/intro-setup|Intro / Setup]]');
    expect(secondLesson).toContain('[[4-Curriculum/Course Index|Course Index]]');
  });

  it('resumes Stage 4 from cached progress without rewriting completed lessons', async () => {
    const grounded = buildGroundedMode();
    const curriculum = makeCurriculum({
      courseId: grounded.conceptList.courseId,
      modules: [
        {
          id: 'module-1',
          title: 'Foundations',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Supervised Learning Basics',
              summary: 'Learn the core idea.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
            {
              id: 'lesson-2',
              title: 'Classification in Practice',
              summary: 'Use labels to predict classes.',
              prerequisiteLessonIds: ['lesson-1'],
              relatedConceptIds: ['classification'],
              difficulty: 'intermediate',
              condensed: false,
            },
          ],
        },
      ],
    });

    const writes = new Map<string, string>();
    const openRouter = {
      chat: vi.fn().mockResolvedValue({
        content: buildLessonMarkdown('Classification in Practice', 430),
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    };

    const result = await runStage4({
      app: {} as never,
      openRouter: openRouter as never,
      courseId: curriculum.courseId,
      curriculum,
      concepts: grounded.conceptList.concepts,
      contextText: grounded.contextText,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      } as never,
      initialProgress: {
        courseId: curriculum.courseId,
        lessons: [
          {
            lessonId: 'lesson-1',
            filePath: '4-Curriculum/foundations/supervised-learning-basics.md',
            status: 'written',
            sourceRefs: ['intro-to-ml.md'],
          },
        ],
        startedAt: '2024-01-01T00:00:00.000Z',
      },
      writeLesson: vi.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
      writeMoc: vi.fn(async () => undefined),
      writeCanvas: vi.fn(async () => undefined),
      writeCourseIndex: vi.fn(async () => undefined),
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).not.toBeNull();
    expect(openRouter.chat).toHaveBeenCalledTimes(1);
    expect(writes.has('4-Curriculum/foundations/supervised-learning-basics.md')).toBe(false);
    expect(writes.has('4-Curriculum/foundations/classification-in-practice.md')).toBe(true);
    expect(result?.lessons[0]?.status).toBe('written');
    expect(result?.lessons[1]?.status).toBe('written');
  });

  it('cancels Stage 4, releases the lock, and stops before writing the lesson', async () => {
    const grounded = buildGroundedMode();
    const curriculum = makeCurriculum({
      courseId: grounded.conceptList.courseId,
      modules: [
        {
          id: 'module-1',
          title: 'Foundations',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Supervised Learning Basics',
              summary: 'Learn the core idea.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['supervised-learning'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    });

    let resolveChat!: (value: { content: string; usage: { inputTokens: number; outputTokens: number } }) => void;
    const chatPromise = new Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }>((resolve) => {
      resolveChat = resolve;
    });
    const releaseLock = vi.fn().mockResolvedValue(undefined);
    const writeLesson = vi.fn().mockResolvedValue(undefined);

    const runner = new Stage4Runner({
      app: {} as never,
      openRouter: {
        chat: vi.fn().mockReturnValue(chatPromise),
      } as never,
      courseId: curriculum.courseId,
      curriculum,
      concepts: grounded.conceptList.concepts,
      contextText: grounded.contextText,
      model: 'test-model',
      lockService: {
        acquireLock: vi.fn().mockResolvedValue(true),
        getLockInfo: vi.fn(),
        releaseLock,
      } as never,
      writeLesson,
      writeMoc: vi.fn().mockResolvedValue(undefined),
      writeCanvas: vi.fn().mockResolvedValue(undefined),
      writeCourseIndex: vi.fn().mockResolvedValue(undefined),
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    const runPromise = runner.run();
    await Promise.resolve();
    await runner.cancel();
    resolveChat({
      content: buildLessonMarkdown('Supervised Learning Basics', 430),
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await expect(runPromise).rejects.toBeInstanceOf(GenerationCancelledError);
    expect(releaseLock).toHaveBeenCalledTimes(1);
    expect(writeLesson).not.toHaveBeenCalled();
  });
});
