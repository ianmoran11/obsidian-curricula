import { DataAdapter } from 'obsidian';
import {
  validate,
  validateConceptList,
  validateCourseMeta,
  validateCurriculum,
  validateProficiencyMap,
  validateScopedTaxonomy,
  validators,
} from './validator';
import type {
  ConceptList,
  CourseId,
  CourseMeta,
  Curriculum,
  GenerationProgress,
  ProficiencyMap,
  ScopedTaxonomy,
  StageCache,
} from '../interfaces';

export class CacheService {
  private adapter: DataAdapter;
  private pluginDir: string;

  constructor(adapter: DataAdapter, pluginDir: string) {
    this.adapter = adapter;
    this.pluginDir = pluginDir;
  }

  private cacheDir(courseId: CourseId): string {
    return `${this.pluginDir}/cache/${courseId}`;
  }

  private normalizeLastCompletedStage(cache: StageCache): 0 | 1 | 2 | 3 | 4 | null {
    const stages = [cache.stage0, cache.stage1, cache.stage2, cache.stage3, cache.stage4];
    let lastCompleted: 0 | 1 | 2 | 3 | 4 | null = null;

    for (let stage = 0; stage < stages.length; stage++) {
      if (!stages[stage]) {
        break;
      }

      lastCompleted = stage as 0 | 1 | 2 | 3 | 4;
    }

    return lastCompleted;
  }

  private validateStageData(
    stage: 0 | 1 | 2 | 3 | 4,
    data: unknown
  ): ScopedTaxonomy | ConceptList | ProficiencyMap | Curriculum | GenerationProgress {
    switch (stage) {
      case 0:
        return validateScopedTaxonomy(data);
      case 1:
        return validateConceptList(data);
      case 2:
        return validateProficiencyMap(data);
      case 3:
        return validateCurriculum(data);
      case 4:
        return validate(validators.generationProgress, data);
    }
  }

  async writeStage(
    courseId: CourseId,
    stage: 0 | 1 | 2 | 3 | 4,
    data: unknown,
    _currentCache: StageCache
  ): Promise<void> {
    const dir = this.cacheDir(courseId);
    await this.adapter.mkdir(dir);

    const tmpPath = `${dir}/stage${stage}.tmp`;
    const finalPath = `${dir}/stage${stage}.json`;

    const json = JSON.stringify(this.validateStageData(stage, data), null, 2);
    await this.adapter.write(tmpPath, json);
    await this.adapter.rename(tmpPath, finalPath);
  }

  async readCache(courseId: CourseId): Promise<StageCache | null> {
    const dir = this.cacheDir(courseId);

    try {
      const metaPath = `${dir}/meta.json`;
      const metaContent = await this.adapter.read(metaPath);
      const meta = validateCourseMeta(JSON.parse(metaContent));

      const cache: StageCache = { meta };

      for (let stage = 0; stage <= 4; stage++) {
        const stagePath = `${dir}/stage${stage}.json`;
        try {
          const content = await this.adapter.read(stagePath);
          const stageData = this.validateStageData(
            stage as 0 | 1 | 2 | 3 | 4,
            JSON.parse(content)
          );
          const stageKey = `stage${stage}` as keyof StageCache;
          (cache as unknown as Record<string, unknown>)[stageKey] = stageData;
        } catch {
          // Missing or invalid stage files are treated as incomplete progress.
        }
      }

      cache.meta.lastStageCompleted = this.normalizeLastCompletedStage(cache);
      return cache;
    } catch {
      return null;
    }
  }

  async writeMeta(courseId: CourseId, meta: CourseMeta): Promise<void> {
    const dir = this.cacheDir(courseId);
    await this.adapter.mkdir(dir);

    const tmpPath = `${dir}/meta.tmp`;
    const finalPath = `${dir}/meta.json`;

    await this.adapter.write(tmpPath, JSON.stringify(meta, null, 2));
    await this.adapter.rename(tmpPath, finalPath);
  }

  async getCourseIds(): Promise<CourseId[]> {
    const cacheRoot = `${this.pluginDir}/cache`;

    try {
      const files = await this.adapter.list(cacheRoot);
      const dirs = files.folders;
      return dirs.map(d => {
        const parts = d.split('/');
        return parts[parts.length - 1] as CourseId;
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  async clearCourse(courseId: CourseId): Promise<void> {
    const dir = this.cacheDir(courseId);
    try {
      const files = await this.adapter.list(dir);
      for (const file of files.files) {
        await this.adapter.remove(file);
      }
      for (const folder of files.folders) {
        await this.adapter.remove(folder);
      }
      await this.adapter.remove(dir);
    } catch {
      // Ignore errors during clear
    }
  }

  async resumeFrom(courseId: CourseId): Promise<{ nextStage: 0 | 1 | 2 | 3 | 4; cache: StageCache } | null> {
    const cache = await this.readCache(courseId);
    if (!cache) return null;

    const lastStage = this.normalizeLastCompletedStage(cache);
    cache.meta.lastStageCompleted = lastStage;
    let nextStage: 0 | 1 | 2 | 3 | 4;

    if (lastStage === null) {
      nextStage = 0;
    } else if (lastStage >= 4) {
      return null;
    } else {
      nextStage = (lastStage + 1) as 0 | 1 | 2 | 3 | 4;
    }

    return { nextStage, cache };
  }
}
