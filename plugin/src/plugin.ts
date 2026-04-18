import { Modal, Notice, Plugin } from 'obsidian';
import { CurriculaSettingsTab, loadSettings } from './settings';
import { OPENROUTER_BASE_URL, VAULT_PATHS } from './constants';
import { CacheService } from './services/cache';
import { LockService } from './services/lock';
import { OpenRouterService } from './services/openrouter';
import { ContextBuilder } from './services/context';
import { runStage0 } from './stages/stage0-topic';
import { runStage1 } from './stages/stage1-concepts';
import { runStage2 } from './stages/stage2-diagnostic';
import { runStage3 } from './stages/stage3-curriculum';
import { GenerationCancelledError, Stage4Runner } from './stages/stage4-generate';
import { createSyllabusEditor } from './ui/syllabus-editor-view';
import { createProgressView } from './ui/progress-view';
import { ResumePromptModal } from './ui/resume-modal';
import type {
  ConceptList,
  CourseId,
  CourseMeta,
  Curriculum,
  GenerationProgress,
  ProficiencyMap,
  ScopedTaxonomy,
  StageCache,
} from './interfaces';
import type { CurriculaSettings } from './settings';

const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';
const DEFAULT_MODEL_CONTEXT_LENGTH = 32000;

export class CurriculaPlugin extends Plugin {
  settingsTab!: CurriculaSettingsTab;
  settings!: CurriculaSettings;
  cacheService!: CacheService;
  lockService!: LockService;
  openRouter!: OpenRouterService;
  contextBuilder!: ContextBuilder;

  async onload(): Promise<void> {
    this.settings = await loadSettings(this);
    this.settingsTab = new CurriculaSettingsTab(this.app, this, this.settings);
    this.addSettingTab(this.settingsTab);

    this.openRouter = new OpenRouterService({
      apiKey: this.settings.openRouterApiKey,
      baseUrl: OPENROUTER_BASE_URL,
    });
    this.openRouter.hydrateModelsCache(this.settings._modelsCache);

    this.cacheService = new CacheService(this.app.vault.adapter, this.manifest.dir || '');
    this.lockService = new LockService(this.app.vault, this.app.vault.adapter);
    this.contextBuilder = new ContextBuilder(this.app.vault);

    this.addCommand({
      id: 'curricula:start-new-course',
      name: 'Start New Course',
      callback: () => {
        void this.startNewCourse();
      }
    });

    this.addRibbonIcon('graduation-cap', 'Start New Course', () => {
      void this.startNewCourse();
    });

    await this.checkForInProgressCourses();
  }

  async applySettings(settings: CurriculaSettings): Promise<void> {
    this.settings = {
      ...settings,
      promptOverrides: {
        ...settings.promptOverrides,
      },
    };

    if (this.openRouter) {
      this.openRouter.updateConfig({
        apiKey: this.settings.openRouterApiKey,
        baseUrl: OPENROUTER_BASE_URL,
      });
      this.openRouter.hydrateModelsCache(this.settings._modelsCache);
    }

    await this.saveData(this.settings);
  }

  private async startNewCourse(): Promise<void> {
    const courseId = this.createCourseId();
    const cache = this.createInitialCache(courseId);

    try {
      await this.cacheService.writeMeta(courseId, cache.meta);

      const taxonomy = await runStage0(
        this.app,
        this.openRouter,
        this.contextBuilder,
        courseId,
        {
          model: this.getActiveModel(),
          promptTemplate: this.getPromptTemplate('stage0'),
        }
      );
      if (!taxonomy) {
        return;
      }

      cache.meta.seedTopic = taxonomy.root.title;
      await this.persistStage(cache, 0, taxonomy);

      const concepts = await this.runStage1Flow(courseId, taxonomy);
      if (!concepts) {
        return;
      }
      await this.persistStage(cache, 1, concepts);

      const proficiency = await runStage2({
        app: this.app,
        concepts,
        courseId,
        onComplete: () => undefined,
        onError: () => undefined,
      });
      if (!proficiency) {
        return;
      }
      await this.persistStage(cache, 2, proficiency);

      const draftCurriculum = await this.runStage3Flow(courseId, taxonomy, concepts, proficiency);
      if (!draftCurriculum) {
        return;
      }

      const curriculum = await this.openSyllabusEditor(draftCurriculum);
      if (!curriculum) {
        return;
      }
      await this.persistStage(cache, 3, curriculum);

      const progress = await this.runStage4Flow(cache, courseId, curriculum, concepts);
      if (!progress) {
        return;
      }
      await this.persistStage(cache, 4, progress);

      new Notice(`Course ready: ${curriculum.title}`);
    } catch (error) {
      new Notice(`Course generation failed: ${(error as Error).message}`);
    }
  }

  private createInitialCache(courseId: CourseId): StageCache {
    const meta: CourseMeta = {
      courseId,
      seedTopic: '',
      createdAt: new Date().toISOString(),
      lastStageCompleted: null,
      modelUsed: this.getActiveModel(),
    };

    return { meta };
  }

  private getActiveModel(): string {
    return this.settings.defaultModel || DEFAULT_MODEL;
  }

  private getPromptTemplate(stage: keyof CurriculaSettings['promptOverrides']): string | undefined {
    const override = this.settings.promptOverrides[stage]?.trim();
    return override ? override : undefined;
  }

  private async persistStage(
    cache: StageCache,
    stage: 0 | 1 | 2 | 3 | 4,
    data: ScopedTaxonomy | ConceptList | ProficiencyMap | Curriculum | GenerationProgress
  ): Promise<void> {
    cache.meta.lastStageCompleted = stage;

    if (stage === 0) {
      cache.stage0 = data as ScopedTaxonomy;
    } else if (stage === 1) {
      cache.stage1 = data as ConceptList;
    } else if (stage === 2) {
      cache.stage2 = data as ProficiencyMap;
    } else if (stage === 3) {
      cache.stage3 = data as Curriculum;
    } else {
      cache.stage4 = data as GenerationProgress;
    }

    await this.cacheService.writeMeta(cache.meta.courseId, cache.meta);
    await this.cacheService.writeStage(cache.meta.courseId, stage, data, cache);
  }

  private async runStage1Flow(
    courseId: CourseId,
    taxonomy: ScopedTaxonomy
  ): Promise<ConceptList | null> {
    return new Promise((resolve) => {
      let settled = false;

      const finish = (result: ConceptList | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      void runStage1({
        app: this.app,
        openRouter: this.openRouter,
        contextBuilder: this.contextBuilder,
        taxonomy,
        courseId,
        model: this.getActiveModel(),
        modelContextLength: DEFAULT_MODEL_CONTEXT_LENGTH,
        promptTemplate: this.getPromptTemplate('stage1'),
        onComplete: (concepts) => finish(concepts),
        onError: () => finish(null),
      }).then((result) => {
        if (result) {
          finish(result);
        }
      }).catch(() => {
        finish(null);
      });
    });
  }

  private async runStage3Flow(
    courseId: CourseId,
    taxonomy: ScopedTaxonomy,
    concepts: ConceptList,
    proficiency: ProficiencyMap
  ): Promise<Curriculum | null> {
    return new Promise((resolve) => {
      let settled = false;

      const finish = (result: Curriculum | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      void runStage3({
        app: this.app,
        openRouter: this.openRouter,
        contextBuilder: this.contextBuilder,
        lockService: this.lockService,
        taxonomy,
        concepts,
        proficiency,
        courseId,
        model: this.getActiveModel(),
        modelContextLength: DEFAULT_MODEL_CONTEXT_LENGTH,
        promptTemplate: this.getPromptTemplate('stage3'),
        onComplete: (curriculum) => finish(curriculum),
        onError: () => finish(null),
      }).then((result) => {
        if (result) {
          finish(result);
        }
      }).catch(() => {
        finish(null);
      });
    });
  }

  private async openSyllabusEditor(curriculum: Curriculum): Promise<Curriculum | null> {
    return new Promise((resolve) => {
      let settled = false;
      const modal = new Modal(this.app);

      const finish = (result: Curriculum | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        modal.close();
        resolve(result);
      };

      modal.onOpen = () => {
        createSyllabusEditor({
          container: modal.contentEl,
          curriculum,
          onSave: (updatedCurriculum) => finish(updatedCurriculum),
          onCancel: () => finish(null),
        });
      };

      modal.onClose = () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      };

      modal.open();
    });
  }

  private async runStage4Flow(
    cache: StageCache,
    courseId: CourseId,
    curriculum: Curriculum,
    concepts: ConceptList,
    initialProgress?: GenerationProgress
  ): Promise<GenerationProgress | null> {
    const context = await this.contextBuilder.buildContext(DEFAULT_MODEL_CONTEXT_LENGTH);
    let runner: Stage4Runner | null = null;
    const modal = new Modal(this.app);
    const closeAfterCancel = async (): Promise<void> => {
      if (!runner) {
        modal.close();
        return;
      }

      await runner.cancel();
      modal.close();
    };

    runner = new Stage4Runner({
      app: this.app,
      openRouter: this.openRouter,
      courseId,
      curriculum,
      concepts: concepts.concepts,
      contextText: context.text,
      model: this.getActiveModel(),
      promptTemplate: this.getPromptTemplate('stage4'),
      lockService: this.lockService,
      initialProgress,
      writeLesson: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeMoc: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeCanvas: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeCourseIndex: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      onProgress: async (nextProgress) => {
        view.update(nextProgress);
        await this.persistStage(cache, 4, nextProgress);
      },
      onComplete: () => {
        modal.close();
      },
      onError: (error) => {
        new Notice(`Generation failed: ${error.message}`);
      },
    });
    let view = createProgressView({
      container: modal.contentEl,
      progress: runner.getProgress(),
      onCancel: () => {
        void closeAfterCancel();
      },
    });

    modal.onOpen = () => {
      view = createProgressView({
        container: modal.contentEl,
        progress: runner?.getProgress() ?? this.createInitialProgress(courseId, curriculum),
        onCancel: () => {
          void closeAfterCancel();
        },
      });
    };

    modal.open();

    try {
      const progress = await runner.run();
      modal.close();
      return progress;
    } catch (error) {
      modal.close();
      if (error instanceof GenerationCancelledError) {
        return null;
      }
      throw error;
    }
  }

  private createInitialProgress(courseId: CourseId, curriculum: Curriculum): GenerationProgress {
    return {
      courseId,
      lessons: curriculum.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
          lessonId: lesson.id,
          filePath: '',
          status: 'pending' as const,
          sourceRefs: [],
        }))
      ),
      startedAt: new Date().toISOString(),
    };
  }

  private async writeVaultFile(path: string, content: string): Promise<void> {
    await this.ensureFolder(path.split('/').slice(0, -1));
    const tmpPath = `${path}.tmp`;
    await this.app.vault.adapter.write(tmpPath, content);
    await this.app.vault.adapter.rename(tmpPath, path);
  }

  private async ensureFolder(parts: string[]): Promise<void> {
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      try {
        await this.app.vault.adapter.mkdir(current);
      } catch {
        // Folder already exists.
      }
    }
  }

  private createCourseId(): CourseId {
    return `course-${Date.now()}` as CourseId;
  }

  private async checkForInProgressCourses(): Promise<void> {
    try {
      const courseIds = await this.cacheService.getCourseIds();

      for (const courseId of courseIds) {
        const resumeInfo = await this.cacheService.resumeFrom(courseId);
        if (resumeInfo) {
          const shouldResume = await this.promptResumeCourse(resumeInfo.cache.meta, resumeInfo.nextStage);
          if (shouldResume) {
            await this.resumeCourse(resumeInfo);
            break;
          }
        }
      }
    } catch {
      // Ignore errors during resume check
    }
  }

  private async promptResumeCourse(
    meta: CourseMeta,
    nextStage: 0 | 1 | 2 | 3 | 4
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const modal = new ResumePromptModal(this.app, {
        courseLabel: meta.seedTopic || meta.courseId,
        stageLabel: this.getStageLabel(nextStage),
        onResume: () => {
          settled = true;
          resolve(true);
        },
        onDismiss: () => {
          settled = true;
          resolve(false);
        },
      });

      modal.onClose = () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };

      modal.open();
    });
  }

  private getStageLabel(stage: 0 | 1 | 2 | 3 | 4): string {
    const stageNames: Record<0 | 1 | 2 | 3 | 4, string> = {
      0: 'Stage 0: Topic Explorer',
      1: 'Stage 1: Concept Extraction',
      2: 'Stage 2: Diagnostic',
      3: 'Stage 3: Curriculum Design',
      4: 'Stage 4: Content Generation',
    };
    return stageNames[stage];
  }

  private async resumeCourse(resumeInfo: { nextStage: 0 | 1 | 2 | 3 | 4; cache: StageCache }): Promise<void> {
    const { nextStage, cache } = resumeInfo;
    const courseId = cache.meta.courseId;

    if (nextStage === 0 || !cache.stage0) {
      new Notice(`Cannot resume ${courseId}: Stage 0 input was never completed.`);
      return;
    }

    let concepts: ConceptList | null = cache.stage1 ?? null;
    if (nextStage <= 1 || !concepts) {
      concepts = await this.runStage1Flow(courseId, cache.stage0);
      if (!concepts) {
        return;
      }
      await this.persistStage(cache, 1, concepts);
    }

    let proficiency: ProficiencyMap | null = cache.stage2 ?? null;
    if (nextStage <= 2 || !proficiency) {
      proficiency = await runStage2({
        app: this.app,
        concepts,
        courseId,
        onComplete: () => undefined,
        onError: () => undefined,
      });
      if (!proficiency) {
        return;
      }
      await this.persistStage(cache, 2, proficiency);
    }

    let curriculum: Curriculum | null = cache.stage3 ?? null;
    if (nextStage <= 3 || !curriculum) {
      const draftCurriculum = await this.runStage3Flow(courseId, cache.stage0, concepts, proficiency);
      if (!draftCurriculum) {
        return;
      }

      curriculum = await this.openSyllabusEditor(draftCurriculum);
      if (!curriculum) {
        return;
      }
      await this.persistStage(cache, 3, curriculum);
    }

    const progress = await this.runStage4Flow(cache, courseId, curriculum, concepts, cache.stage4);
    if (!progress) {
      return;
    }
    await this.persistStage(cache, 4, progress);
    new Notice(`Course ready: ${curriculum.title}`);
  }
}
