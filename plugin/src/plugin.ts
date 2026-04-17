import { Notice, Plugin } from 'obsidian';
import { CurriculaSettingsTab, loadSettings } from './settings';
import { OPENROUTER_BASE_URL } from './constants';
import { CacheService } from './services/cache';
import { LockService } from './services/lock';
import { OpenRouterService } from './services/openrouter';
import { ContextBuilder } from './services/context';
import type { CurriculaSettings } from './settings';

export class CurriculaPlugin extends Plugin {
  settingsTab!: CurriculaSettingsTab;
  settings!: CurriculaSettings;
  cacheService!: CacheService;
  lockService!: LockService;
  openRouter!: OpenRouterService;
  contextBuilder!: ContextBuilder;

  async onLoad(): Promise<void> {
    this.settings = loadSettings(this);
    this.settingsTab = new CurriculaSettingsTab(this.app, this, this.settings);
    this.addSettingTab(this.settingsTab);

    this.openRouter = new OpenRouterService({
      apiKey: this.settings.openRouterApiKey,
      baseUrl: OPENROUTER_BASE_URL,
    });

    this.cacheService = new CacheService(this.app.vault.adapter, this.manifest.dir || '');
    this.lockService = new LockService(this.app.vault, this.app.vault.adapter);
    this.contextBuilder = new ContextBuilder(this.app.vault);

    this.addCommand({
      id: 'auto-tutor:start-new-course',
      name: 'Start New Course',
      callback: () => {
        new Notice('Start New Course - coming soon');
      }
    });

    this.addRibbonIcon('graduation-cap', 'Start New Course', () => {
      new Notice('Start New Course - coming soon');
    });

    await this.checkForInProgressCourses();
  }

  private async checkForInProgressCourses(): Promise<void> {
    try {
      const courseIds = await this.cacheService.getCourseIds();

      for (const courseId of courseIds) {
        const resumeInfo = await this.cacheService.resumeFrom(courseId);
        if (resumeInfo) {
          const lockInfo = await this.lockService.getLockInfo();
          if (lockInfo && lockInfo.courseId === courseId) {
            const isStale = Date.now() - lockInfo.startedAt >= 30 * 60 * 1000;
            if (!isStale) {
              new Notice(`Resume course: ${courseId}? Generation in progress on ${lockInfo.deviceName}`);
            }
          }
        }
      }
    } catch {
      // Ignore errors during resume check
    }
  }
}