import { DataAdapter } from 'obsidian';
import { validateCourseMeta } from './validator';
import type { StageCache, CourseMeta, CourseId } from '../interfaces';

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

  async writeStage(
    courseId: CourseId,
    stage: 0 | 1 | 2 | 3 | 4,
    data: unknown,
    currentCache: StageCache
  ): Promise<void> {
    const dir = this.cacheDir(courseId);
    const stageKey = `stage${stage}` as keyof StageCache;
    const updatedCache = { ...currentCache, [stageKey]: data };

    const tmpPath = `${dir}/stage${stage}.tmp`;
    const finalPath = `${dir}/stage${stage}.json`;

    const json = JSON.stringify(updatedCache, null, 2);
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
          const stageData = JSON.parse(content);
          const stageKey = `stage${stage}` as keyof StageCache;
          (cache as unknown as Record<string, unknown>)[stageKey] = stageData;
        } catch {
          // Stage file doesn't exist, continue
        }
      }

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

    const lastStage = cache.meta.lastStageCompleted;
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