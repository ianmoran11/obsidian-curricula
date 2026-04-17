import { App, Notice, Platform } from 'obsidian';
import { composeStage4Prompt, isKnowledgeOnlyPlaceholder } from '../prompts';
import { OpenRouterService } from '../services/openrouter';
import { buildFrontmatter } from '../writers/frontmatter';
import { buildLessonFileName } from '../writers/markdown';
import { buildBreadcrumb, buildPrevNext } from '../writers/navigation';
import { buildCourseIndex, buildMoc } from '../writers/moc';
import { generateCanvas } from '../writers/canvas';
import type {
  LessonSpec,
  ModuleSpec,
  CourseId,
  Concept,
  Curriculum,
  GenerationProgress,
  GeneratedLesson,
} from '../interfaces';
import type { LockService } from '../services/lock';
import { showConflictModal } from '../ui/conflict-modal';

function getDeviceName(): string {
  const platform = Platform.isDesktop ? 'desktop' : Platform.isMobile ? 'mobile' : 'unknown';
  return `${platform}-${Date.now()}`;
}

type GenerationMode = 'grounded' | 'augmented' | 'knowledge-only';

interface LessonRecord {
  module: ModuleSpec;
  moduleSlug: string;
  mocPath: string;
  lesson: LessonSpec;
  lessonPath: string;
}

export interface Stage4Options {
  app: App;
  openRouter: OpenRouterService;
  courseId: CourseId;
  curriculum: Curriculum;
  concepts: Concept[];
  contextText: string;
  model: string;
  promptTemplate?: string;
  lockService: LockService;
  initialProgress?: GenerationProgress;
  writeLesson: (filePath: string, content: string) => Promise<void>;
  writeMoc: (filePath: string, content: string) => Promise<void>;
  writeCanvas: (filePath: string, content: string) => Promise<void>;
  writeCourseIndex: (filePath: string, content: string) => Promise<void>;
  onProgress: (progress: GenerationProgress) => Promise<void> | void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class GenerationCancelledError extends Error {
  constructor() {
    super('Generation cancelled');
    this.name = 'GenerationCancelledError';
  }
}

export class Stage4Runner {
  private options: Stage4Options;
  private progress: GenerationProgress;
  private lessonRecords: LessonRecord[];
  private readonly abortController = new AbortController();
  private cancelRequested = false;
  private lockHeld = false;
  private lockReleased = false;

  constructor(options: Stage4Options) {
    this.options = options;
    this.lessonRecords = this.buildLessonRecords();
    this.progress = this.createInitialProgress();
  }

  async run(): Promise<GenerationProgress> {
    const deviceName = getDeviceName();
    const lockAcquired = await this.options.lockService.acquireLock(this.options.courseId, deviceName);

    if (!lockAcquired) {
      const lockInfo = await this.options.lockService.getLockInfo();
      if (lockInfo) {
        showConflictModal({
          app: this.options.app,
          lockInfo,
          onCancel: () => {
            this.options.onError(new Error('Cancelled: generation in progress on another device'));
          },
        });
      } else {
        new Notice('Could not acquire lock. Please try again.');
        this.options.onError(new Error('Could not acquire lock'));
      }
      throw new Error('Could not acquire lock');
    }

    this.lockHeld = true;

    try {
      this.throwIfCancelled();
      await this.generateAllLessons();
      this.throwIfCancelled();
      await this.generateMocs();
      this.throwIfCancelled();
      await this.generateCanvas();
      this.throwIfCancelled();
      await this.generateCourseIndex();
      this.progress.completedAt = new Date().toISOString();
      await this.options.onProgress(this.cloneProgress());
      await this.releaseLockOnce();
      this.options.onComplete();
      return this.progress;
    } catch (error) {
      await this.releaseLockOnce();
      if (!(error instanceof GenerationCancelledError)) {
        this.options.onError(error as Error);
      }
      throw error;
    }
  }

  async cancel(): Promise<void> {
    this.cancelRequested = true;
    this.abortController.abort();
    await this.releaseLockOnce();
  }

  private buildLessonRecords(): LessonRecord[] {
    const records: LessonRecord[] = [];

    for (const module of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module.title);
      const existingNames = new Set<string>();
      const mocPath = `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`;

      for (const lesson of module.lessons) {
        const fileName = buildLessonFileName(lesson.title, existingNames);
        records.push({
          module,
          moduleSlug,
          mocPath,
          lesson,
          lessonPath: `4-Curriculum/${moduleSlug}/${fileName}`,
        });
      }
    }

    return records;
  }

  private async generateAllLessons(): Promise<void> {
    for (let index = 0; index < this.lessonRecords.length; index++) {
      this.throwIfCancelled();
      const record = this.lessonRecords[index];
      const progressIndex = this.progress.lessons.findIndex((lesson) => lesson.lessonId === record.lesson.id);
      const existingProgress = progressIndex === -1 ? null : this.progress.lessons[progressIndex];

      if (existingProgress?.status === 'written') {
        continue;
      }

      const relatedConcepts = this.getRelatedConcepts(record.lesson);
      const sourceRefs = this.collectSourceRefs(relatedConcepts);

      if (progressIndex !== -1) {
        this.progress.lessons[progressIndex] = {
          ...this.progress.lessons[progressIndex],
          status: 'writing',
          sourceRefs,
        };
        await this.options.onProgress(this.cloneProgress());
      }

      const lessonMarkdown = await this.generateLessonMarkdown(record.lesson, relatedConcepts);
      this.throwIfCancelled();
      const generationMode = this.classifyGenerationMode(sourceRefs);
      const content = this.composeLessonFile(record, lessonMarkdown, sourceRefs, generationMode, index);

      await this.options.writeLesson(record.lessonPath, content);
      this.throwIfCancelled();

      if (progressIndex !== -1) {
        this.progress.lessons[progressIndex] = {
          ...this.progress.lessons[progressIndex],
          filePath: record.lessonPath,
          status: 'written',
          sourceRefs,
          error: undefined,
        };
        await this.options.onProgress(this.cloneProgress());
      }
    }
  }

  private async generateLessonMarkdown(lesson: LessonSpec, relatedConcepts: Concept[]): Promise<string> {
    const prompt = composeStage4Prompt(
      lesson,
      relatedConcepts,
      this.options.contextText,
      this.options.promptTemplate
    );

    const result = await this.options.openRouter.chat({
      model: this.options.model,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'text',
      temperature: 0.4,
      signal: this.abortController.signal,
    });

    return this.validateLessonMarkdown(lesson, result.content);
  }

  private validateLessonMarkdown(lesson: LessonSpec, markdown: string): string {
    const trimmed = markdown.trim();
    if (!trimmed) {
      throw new Error(`Stage 4 returned empty content for lesson "${lesson.title}"`);
    }

    if (trimmed.startsWith('---')) {
      throw new Error(`Stage 4 returned frontmatter for lesson "${lesson.title}"`);
    }

    if (!trimmed.startsWith(`# ${lesson.title}`)) {
      throw new Error(`Stage 4 returned an invalid heading for lesson "${lesson.title}"`);
    }

    if (!trimmed.includes('> [!question]')) {
      throw new Error(`Stage 4 lesson "${lesson.title}" is missing the required question callout`);
    }

    const wordCount = trimmed.replace(/^# .+$/m, '').trim().split(/\s+/).filter(Boolean).length;
    const minWords = lesson.condensed ? 120 : 400;
    const maxWords = lesson.condensed ? 250 : 900;
    if (wordCount < minWords || wordCount > maxWords) {
      throw new Error(
        `Stage 4 lesson "${lesson.title}" has ${wordCount} words; expected ${minWords}-${maxWords}`
      );
    }

    return trimmed;
  }

  private composeLessonFile(
    record: LessonRecord,
    markdown: string,
    sourceRefs: string[],
    generationMode: GenerationMode,
    lessonIndex: number
  ): string {
    const generatedAt = new Date().toISOString();
    const frontmatter = buildFrontmatter({
      status: 'unread',
      difficulty: record.lesson.difficulty,
      lessonId: record.lesson.id,
      moduleId: record.module.id,
      sourceRefs,
      generated_at: generatedAt,
      generation_mode: generationMode,
    });

    const breadcrumb = buildBreadcrumb(
      '4-Curriculum/Course Index.md',
      record.mocPath,
      record.module.title
    ).trimEnd();
    const prevNext = buildPrevNext(
      this.getAdjacentLesson(lessonIndex - 1),
      this.getAdjacentLesson(lessonIndex + 1),
      'Course Index.md'
    ).trim();

    return [frontmatter, breadcrumb, '', markdown, '', prevNext, ''].join('\n');
  }

  private getAdjacentLesson(index: number): { title: string; filePath: string } | null {
    if (index < 0 || index >= this.lessonRecords.length) {
      return null;
    }

    const record = this.lessonRecords[index];
    return {
      title: record.lesson.title,
      filePath: record.lessonPath,
    };
  }

  private async generateMocs(): Promise<void> {
    for (const module of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module.title);
      const mocPath = `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`;
      const lessons = this.lessonRecords
        .filter((record) => record.module.id === module.id)
        .map((record) => ({
          title: record.lesson.title,
          filePath: record.lessonPath,
        }));

      await this.options.writeMoc(mocPath, buildMoc(module.title, lessons));
    }
  }

  private async generateCanvas(): Promise<void> {
    const canvasPath = '4-Curriculum/course.canvas';
    await this.options.writeCanvas(canvasPath, generateCanvas(this.options.curriculum));
    this.progress.canvasPath = canvasPath;
  }

  private async generateCourseIndex(): Promise<void> {
    const indexPath = '4-Curriculum/Course Index.md';
    const modules = this.options.curriculum.modules.map((module) => {
      const moduleSlug = this.slugify(module.title);
      return {
        title: module.title,
        mocPath: `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`,
        lessonCount: module.lessons.length,
      };
    });

    await this.options.writeCourseIndex(indexPath, buildCourseIndex(this.options.curriculum.title, modules));
    this.progress.indexPath = indexPath;
  }

  private getRelatedConcepts(lesson: LessonSpec): Concept[] {
    return this.options.concepts.filter((concept) => lesson.relatedConceptIds.includes(concept.id));
  }

  private collectSourceRefs(concepts: Concept[]): string[] {
    return Array.from(new Set(concepts.flatMap((concept) => concept.sourceRefs))).sort();
  }

  private classifyGenerationMode(sourceRefs: string[]): GenerationMode {
    if (isKnowledgeOnlyPlaceholder(this.options.contextText)) {
      return 'knowledge-only';
    }

    return sourceRefs.length > 0 ? 'grounded' : 'augmented';
  }

  private cloneProgress(): GenerationProgress {
    return {
      ...this.progress,
      lessons: this.progress.lessons.map((lesson): GeneratedLesson => ({ ...lesson })),
    };
  }

  private fileStem(path: string): string {
    const fileName = path.split('/').pop() || path;
    return fileName.replace(/\.md$/, '');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  getProgress(): GenerationProgress {
    return this.cloneProgress();
  }

  private createInitialProgress(): GenerationProgress {
    const initial = this.options.initialProgress;
    const priorLessons = new Map((initial?.lessons ?? []).map((lesson) => [lesson.lessonId, lesson]));

    return {
      courseId: this.options.courseId,
      lessons: this.lessonRecords.map((record) => {
        const prior = priorLessons.get(record.lesson.id);
        return {
          lessonId: record.lesson.id,
          filePath: record.lessonPath,
          status: prior?.status === 'written' ? 'written' : 'pending',
          error: prior?.status === 'error' ? prior.error : undefined,
          sourceRefs: prior?.sourceRefs ?? [],
        };
      }),
      canvasPath: initial?.canvasPath,
      indexPath: initial?.indexPath,
      startedAt: initial?.startedAt ?? new Date().toISOString(),
      completedAt: initial?.completedAt,
    };
  }

  private throwIfCancelled(): void {
    if (this.cancelRequested || this.abortController.signal.aborted) {
      throw new GenerationCancelledError();
    }
  }

  private async releaseLockOnce(): Promise<void> {
    if (!this.lockHeld || this.lockReleased) {
      return;
    }

    this.lockReleased = true;
    await this.options.lockService.releaseLock();
  }
}

export async function runStage4(options: Stage4Options): Promise<GenerationProgress | null> {
  const runner = new Stage4Runner(options);
  try {
    return await runner.run();
  } catch {
    return null;
  }
}
