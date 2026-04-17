import { isCoverMode } from './responsive';
import type { GenerationProgress } from '../interfaces';

export interface ProgressViewOptions {
  container: HTMLElement;
  progress: GenerationProgress;
  onCancel: () => void;
}

export class ProgressView {
  private container: HTMLElement;
  private progress: GenerationProgress;
  private onCancel: () => void;
  private progressBar: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(options: ProgressViewOptions) {
    this.container = options.container;
    this.progress = options.progress;
    this.onCancel = options.onCancel;
    this.render();
  }

  render(): void {
    this.container.empty();

    const coverMode = isCoverMode(document.body.offsetWidth);

    this.container.createEl('h2', { text: 'Generating Curriculum' });

    const totalLessons = this.progress.lessons.length;

    if (totalLessons === 0) {
      this.renderLoadingState(coverMode);
      return;
    }

    if (this.hasError()) {
      this.renderErrorState();
      return;
    }

    this.renderProgressContent();
  }

  private renderLoadingState(coverMode: boolean): void {
    const loadingEl = this.container.createDiv('loading-state');
    loadingEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: ${coverMode ? '32px 16px' : '48px 24px'};
      text-align: center;
      min-height: 200px;
    `;

    const spinner = loadingEl.createEl('span', { text: '⟳' });
    spinner.style.cssText = `
      font-size: 32px;
      animation: spin 1s linear infinite;
      display: inline-block;
    `;

    const loadingText = loadingEl.createEl('p', { text: 'Preparing your curriculum...' });
    loadingText.style.cssText = `
      color: var(--text-muted);
      margin: 16px 0 0 0;
      font-size: 14px;
    `;

    const cancelBtn = this.container.createEl('button', { text: 'Cancel Generation' });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--text-error);
      color: var(--text-error);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 24px;
      min-height: 48px;
      min-width: 160px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => this.onCancel());

    this.injectSpinAnimation();
  }

  private renderErrorState(): void {
    const errorEl = this.container.createDiv('error-state');
    errorEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      min-height: 200px;
    `;

    const errorIcon = errorEl.createEl('span', { text: '⚠' });
    errorIcon.style.cssText = `
      font-size: 48px;
      color: var(--text-error);
      margin-bottom: 16px;
    `;

    const errorTitle = errorEl.createEl('h3', { text: 'Generation Failed' });
    errorTitle.style.cssText = `
      color: var(--text-error);
      margin: 0 0 8px 0;
    `;

    const errorMessage = errorEl.createEl('p', { text: this.getErrorMessage() });
    errorMessage.style.cssText = `
      color: var(--text-muted);
      margin: 0 0 24px 0;
      font-size: 14px;
      max-width: 400px;
    `;

    const retryBtn = this.container.createEl('button', { text: 'Retry' });
    retryBtn.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
      min-width: 120px;
      font-size: 14px;
    `;
    retryBtn.addEventListener('click', () => {
      this.container.empty();
      this.render();
    });

    const cancelBtn = this.container.createEl('button', { text: 'Cancel' });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 8px;
      min-height: 48px;
      min-width: 120px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => this.onCancel());
  }

  private renderProgressContent(): void {
    this.statusEl = this.container.createDiv('generation-status');
    this.statusEl.style.marginBottom = '16px';

    const totalLessons = this.progress.lessons.length;
    const writtenLessons = this.progress.lessons.filter(l => l.status === 'written').length;
    const currentLesson = this.progress.lessons.find(l => l.status === 'writing');

    this.statusEl.textContent = `Generating ${writtenLessons + 1} of ${totalLessons}...`;

    this.progressBar = this.container.createDiv('progress-bar');
    this.progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: var(--background-modifier-border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    `;

    const fill = this.progressBar.createDiv('progress-fill');
    fill.style.cssText = `
      height: 100%;
      background: var(--interactive-accent);
      width: ${(writtenLessons / totalLessons) * 100}%;
      transition: width 0.3s ease;
    `;

    const lessonsList = this.container.createDiv('lessons-list');
    lessonsList.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    `;

    for (const lesson of this.progress.lessons) {
      const item = lessonsList.createDiv('lesson-item');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
        min-height: 48px;
      `;

      const statusIcon = item.createEl('span');
      switch (lesson.status) {
        case 'written':
          statusIcon.textContent = '✓';
          statusIcon.style.color = 'var(--text-success)';
          break;
        case 'writing':
          statusIcon.textContent = '⟳';
          statusIcon.style.color = 'var(--interactive-accent)';
          break;
        case 'error':
          statusIcon.textContent = '✗';
          statusIcon.style.color = 'var(--text-error)';
          break;
        default:
          statusIcon.textContent = '○';
          statusIcon.style.color = 'var(--text-muted)';
      }

      const title = item.createEl('span', { text: lesson.lessonId });
      title.style.flex = '1';

      if (lesson.status === 'error' && lesson.error) {
        const errorMsg = item.createEl('span', { text: lesson.error });
        errorMsg.style.color = 'var(--text-error)';
        errorMsg.style.fontSize = '12px';
      }
    }

    const cancelBtn = this.container.createEl('button', { text: 'Cancel Generation' });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--text-error);
      color: var(--text-error);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 16px;
      min-height: 48px;
      min-width: 160px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => this.onCancel());
  }

  private hasError(): boolean {
    return this.progress.lessons.some(l => l.status === 'error');
  }

  private getErrorMessage(): string {
    const errorLesson = this.progress.lessons.find(l => l.status === 'error');
    return errorLesson?.error || 'An unexpected error occurred during curriculum generation.';
  }

  private injectSpinAnimation(): void {
    if (document.querySelector('#curricula-spin-animation')) return;
    const style = document.createElement('style');
    style.id = 'curricula-spin-animation';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  update(progress: GenerationProgress): void {
    this.progress = progress;
    if (this.progressBar) {
      const totalLessons = this.progress.lessons.length;
      if (totalLessons > 0) {
        const writtenLessons = this.progress.lessons.filter(l => l.status === 'written').length;
        const fill = this.progressBar.querySelector('.progress-fill') as HTMLElement;
        if (fill) {
          fill.style.width = `${(writtenLessons / totalLessons) * 100}%`;
        }
      }
    }
    if (this.statusEl) {
      const totalLessons = this.progress.lessons.length;
      if (totalLessons > 0) {
        const writtenLessons = this.progress.lessons.filter(l => l.status === 'written').length;
        this.statusEl.textContent = `Generating ${writtenLessons + 1} of ${totalLessons}...`;
      }
    }
  }
}

export function createProgressView(options: ProgressViewOptions): ProgressView {
  return new ProgressView(options);
}