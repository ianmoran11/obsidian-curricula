import { App, Notice, Platform } from 'obsidian';
import { buildFrontmatter } from '../writers/frontmatter';
import { buildBreadcrumb, buildPrevNext } from '../writers/navigation';
import type { LessonSpec, ModuleSpec, CourseId, Concept, Curriculum, GenerationProgress } from '../interfaces';
import type { LockService } from '../services/lock';
import { showConflictModal } from '../ui/conflict-modal';

function getDeviceName(): string {
  const platform = Platform.isDesktop ? 'desktop' : Platform.isMobile ? 'mobile' : 'unknown';
  return `${platform}-${Date.now()}`;
}

export interface Stage4Options {
  app: App;
  courseId: CourseId;
  curriculum: Curriculum;
  concepts: Concept[];
  contextText: string;
  lockService: LockService;
  writeLesson: (moduleSlug: string, lesson: LessonSpec, content: string) => Promise<void>;
  writeMoc: (moduleSlug: string, content: string) => Promise<void>;
  writeCanvas: (content: string) => Promise<void>;
  writeCourseIndex: (content: string) => Promise<void>;
  onProgress: (progress: GenerationProgress) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class Stage4Runner {
  private options: Stage4Options;
  private progress: GenerationProgress;
  private generatedLessonFiles: Set<string> = new Set();

  constructor(options: Stage4Options) {
    this.options = options;
    this.progress = {
      courseId: options.courseId,
      lessons: options.curriculum.modules.flatMap(m =>
        m.lessons.map(l => ({
          lessonId: l.id,
          filePath: '',
          status: 'pending' as const,
          sourceRefs: [],
        }))
      ),
      startedAt: new Date().toISOString(),
    };
  }

  async run(): Promise<void> {
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
      return;
    }

    try {
      await this.generateAllLessons();
      await this.generateMocs();
      await this.generateCanvas();
      await this.generateCourseIndex();
      this.progress.completedAt = new Date().toISOString();
      await this.options.lockService.releaseLock();
      this.options.onComplete();
    } catch (error) {
      await this.options.lockService.releaseLock();
      this.options.onError(error as Error);
    }
  }

  private async generateAllLessons(): Promise<void> {
    for (const module of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module.title);

      for (const lesson of module.lessons) {
        const lessonIndex = this.progress.lessons.findIndex(l => l.lessonId === lesson.id);
        if (lessonIndex !== -1) {
          this.progress.lessons[lessonIndex].status = 'writing';
          this.options.onProgress({ ...this.progress });
        }

        try {
          const content = this.composeLessonContent(lesson, module);

          await this.options.writeLesson(moduleSlug, lesson, content);

          if (lessonIndex !== -1) {
            this.progress.lessons[lessonIndex].status = 'written';
            this.progress.lessons[lessonIndex].filePath = `4-Curriculum/${moduleSlug}/${this.slugify(lesson.title)}.md`;
            this.options.onProgress({ ...this.progress });
          }
        } catch (error) {
          if (lessonIndex !== -1) {
            this.progress.lessons[lessonIndex].status = 'error';
            this.progress.lessons[lessonIndex].error = (error as Error).message;
          }
        }
      }
    }
  }

  private composeLessonContent(lesson: LessonSpec, module: ModuleSpec): string {
    const relatedConcepts = this.options.concepts.filter(c =>
      lesson.relatedConceptIds.includes(c.id)
    );

    const lessonContent = lesson.title + '\n\n' +
      'This lesson covers ' + lesson.summary + '.\n\n' +
      'Difficulty: ' + lesson.difficulty + (lesson.condensed ? ' (condensed)' : '') + '\n';

    return lessonContent;
  }

  private async generateMocs(): Promise<void> {
    for (const module of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module.title);
      const lessons = module.lessons.map(l => ({
        title: l.title,
        filePath: `4-Curriculum/${moduleSlug}/${this.slugify(l.title)}.md`,
      }));

      const mocContent = [
        `# ${module.title}`,
        '',
        `This module contains ${lessons.length} lessons.`,
        '',
        '## Lessons',
        '',
        ...lessons.map(l => `- [[${l.filePath.split('/').pop()?.replace('.md', '')}|${l.title}]]`),
        '',
      ].join('\n');

      await this.options.writeMoc(moduleSlug, mocContent);
    }
  }

  private async generateCanvas(): Promise<void> {
    const canvasContent = JSON.stringify({
      nodes: this.options.curriculum.modules.flatMap((m, mi) =>
        m.lessons.map((l, li) => ({
          id: `node-${mi}-${li}`,
          type: 'file',
          file: `4-Curriculum/${this.slugify(m.title)}/${this.slugify(l.title)}.md`,
          x: mi * 400,
          y: li * 240,
          width: 320,
          height: 200,
        }))
      ),
      edges: this.options.curriculum.modules.flatMap((m, mi) =>
        m.lessons.flatMap((l, li) =>
          l.prerequisiteLessonIds.map(prereqId => {
            const prereqModuleIdx = this.options.curriculum.modules.findIndex(mod =>
              mod.lessons.some(pl => pl.id === prereqId)
            );
            const prereqLessonIdx = this.options.curriculum.modules[prereqModuleIdx]?.lessons.findIndex(
              pl => pl.id === prereqId
            );
            if (prereqModuleIdx === -1 || prereqLessonIdx === -1) return null;
            return {
              id: `edge-${prereqModuleIdx}-${prereqLessonIdx}-${mi}-${li}`,
              from: { id: `node-${prereqModuleIdx}-${prereqLessonIdx}`, side: 'bottom' as const },
              to: { id: `node-${mi}-${li}`, side: 'top' as const },
            };
          })
        )
      ).filter(Boolean),
    }, null, 2);

    await this.options.writeCanvas(canvasContent);
    this.progress.canvasPath = 'course.canvas';
  }

  private async generateCourseIndex(): Promise<void> {
    const modules = this.options.curriculum.modules.map(m => ({
      title: m.title,
      lessonCount: m.lessons.length,
    }));

    const content = [
      `# ${this.options.curriculum.title}`,
      '',
      `This course contains ${modules.length} modules.`,
      '',
      '## Modules',
      '',
      ...modules.map(mod => `- [[${this.slugify(mod.title)} MOC|${mod.title}]] (${mod.lessonCount} lessons)`),
      '',
    ].join('\n');

    await this.options.writeCourseIndex(content);
    this.progress.indexPath = 'Course Index.md';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  getProgress(): GenerationProgress {
    return this.progress;
  }
}

export async function runStage4(options: Stage4Options): Promise<GenerationProgress | null> {
  const runner = new Stage4Runner(options);
  try {
    await runner.run();
    return runner.getProgress();
  } catch {
    return null;
  }
}