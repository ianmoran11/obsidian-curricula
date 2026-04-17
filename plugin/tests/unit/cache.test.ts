import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../src/services/cache';
import type {
  ConceptList,
  CourseId,
  CourseMeta,
  Curriculum,
  GenerationProgress,
  ProficiencyMap,
  ScopedTaxonomy,
  StageCache,
} from '../../src/interfaces';

class InMemoryAdapter {
  files = new Map<string, string>();
  folders = new Set<string>();

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async rename(from: string, to: string): Promise<void> {
    const content = this.files.get(from);
    if (content === undefined) {
      throw new Error(`Missing source file: ${from}`);
    }

    this.files.delete(from);
    this.files.set(to, content);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`Missing file: ${path}`);
    }

    return content;
  }

  async mkdir(path: string): Promise<void> {
    this.folders.add(path);
  }

  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    const filePrefix = `${path}/`;
    const files = [...this.files.keys()].filter(file => file.startsWith(filePrefix));
    const folders = [...this.folders].filter(folder => folder.startsWith(filePrefix));
    return { files, folders };
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.folders.delete(path);
  }
}

describe('CacheService', () => {
  const pluginDir = '/plugin';
  const courseId = 'test-course-123' as CourseId;
  const courseDir = `${pluginDir}/cache/${courseId}`;

  let adapter: InMemoryAdapter;
  let cacheService: CacheService;
  let meta: CourseMeta;
  let stage0: ScopedTaxonomy;
  let stage1: ConceptList;
  let stage2: ProficiencyMap;
  let stage3: Curriculum;
  let stage4: GenerationProgress;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    cacheService = new CacheService(adapter as never, pluginDir);

    meta = {
      courseId,
      seedTopic: 'Linear Algebra',
      createdAt: '2026-04-18T00:00:00.000Z',
      lastStageCompleted: null,
      modelUsed: 'openrouter/test-model',
    };

    stage0 = {
      courseId,
      root: {
        id: 'root',
        title: 'Linear Algebra',
        children: [
          { id: 'vectors', title: 'Vectors', children: [] },
          { id: 'matrices', title: 'Matrices', children: [] },
        ],
      },
      selectedIds: ['vectors', 'matrices'],
    };

    stage1 = {
      courseId,
      concepts: [
        {
          id: 'vector',
          name: 'Vector',
          definition: 'A quantity with magnitude and direction.',
          sourceRefs: ['intro-to-ml.md'],
        },
      ],
    };

    stage2 = {
      courseId,
      scores: {
        vector: 3,
      },
    };

    stage3 = {
      courseId,
      title: 'Linear Algebra Foundations',
      modules: [
        {
          id: 'module-1',
          title: 'Core Ideas',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Vectors',
              summary: 'Understand vector basics.',
              prerequisiteLessonIds: [],
              relatedConceptIds: ['vector'],
              difficulty: 'intro',
              condensed: false,
            },
          ],
        },
      ],
    };

    stage4 = {
      courseId,
      lessons: [
        {
          lessonId: 'lesson-1',
          filePath: '4-Curriculum/Core Ideas/Vectors.md',
          status: 'written',
          sourceRefs: ['intro-to-ml.md'],
        },
      ],
      canvasPath: '4-Curriculum/course.canvas',
      indexPath: '4-Curriculum/Course Index.md',
      startedAt: '2026-04-18T00:05:00.000Z',
      completedAt: '2026-04-18T00:06:00.000Z',
    };
  });

  async function persistStage(
    stage: 0 | 1 | 2 | 3 | 4,
    data: StageCache['stage0'] | StageCache['stage1'] | StageCache['stage2'] | StageCache['stage3'] | StageCache['stage4']
  ): Promise<void> {
    meta.lastStageCompleted = stage;
    await cacheService.writeMeta(courseId, meta);
    await cacheService.writeStage(courseId, stage, data, { meta });
  }

  it('writes stage files as stage payloads, not nested StageCache objects', async () => {
    await persistStage(0, stage0);

    const stageJson = JSON.parse(await adapter.read(`${courseDir}/stage0.json`));

    expect(stageJson).toEqual(stage0);
    expect(stageJson).not.toHaveProperty('meta');
    expect(stageJson).not.toHaveProperty('stage0');
  });

  it('reconstructs a valid cache from meta and per-stage files across stages 0-4', async () => {
    await persistStage(0, stage0);
    await persistStage(1, stage1);
    await persistStage(2, stage2);
    await persistStage(3, stage3);

    const resumedBeforeStage4 = await cacheService.resumeFrom(courseId);
    expect(resumedBeforeStage4).toEqual({
      nextStage: 4,
      cache: {
        meta: { ...meta, lastStageCompleted: 3 },
        stage0,
        stage1,
        stage2,
        stage3,
      },
    });

    await persistStage(4, stage4);

    const reloaded = await cacheService.readCache(courseId);
    expect(reloaded).toEqual({
      meta: { ...meta, lastStageCompleted: 4 },
      stage0,
      stage1,
      stage2,
      stage3,
      stage4,
    });

    await expect(cacheService.resumeFrom(courseId)).resolves.toBeNull();
  });

  it('resumes from the first missing stage when meta is ahead of the on-disk stage files', async () => {
    await persistStage(0, stage0);
    await persistStage(1, stage1);

    meta.lastStageCompleted = 2;
    await cacheService.writeMeta(courseId, meta);

    const resumed = await cacheService.resumeFrom(courseId);

    expect(resumed).toEqual({
      nextStage: 2,
      cache: {
        meta: { ...meta, lastStageCompleted: 1 },
        stage0,
        stage1,
      },
    });
  });

  it('ignores invalid nested-cache stage files left behind by the old contract', async () => {
    meta.lastStageCompleted = 1;
    await cacheService.writeMeta(courseId, meta);
    await adapter.mkdir(courseDir);
    await adapter.write(
      `${courseDir}/stage0.json`,
      JSON.stringify({
        meta,
        stage0,
      })
    );

    const resumed = await cacheService.resumeFrom(courseId);

    expect(resumed).toEqual({
      nextStage: 0,
      cache: {
        meta: { ...meta, lastStageCompleted: null },
      },
    });
  });

  it('writes meta atomically via tmp then rename', async () => {
    const writeSpy = vi.spyOn(adapter, 'write');
    const renameSpy = vi.spyOn(adapter, 'rename');

    await cacheService.writeMeta(courseId, meta);

    expect(writeSpy).toHaveBeenCalledWith(`${courseDir}/meta.tmp`, expect.any(String));
    expect(renameSpy).toHaveBeenCalledWith(`${courseDir}/meta.tmp`, `${courseDir}/meta.json`);
  });
});
