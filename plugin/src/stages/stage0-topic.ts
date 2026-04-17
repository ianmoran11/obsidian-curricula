import { App, Notice, Modal } from 'obsidian';
import { OpenRouterService } from '../services/openrouter';
import { ContextBuilder } from '../services/context';
import { validateScopedTaxonomy } from '../services/validator';
import { composeStage0Prompt } from '../prompts';
import { TopicInputModal } from '../ui/topic-input-modal';
import { createTaxonomyView, hasAtLeastOneLeafSelected } from '../ui/taxonomy-view';
import type { TaxonomyNode, ScopedTaxonomy, CourseId } from '../interfaces';

export interface Stage0Options {
  app: App;
  openRouter: OpenRouterService;
  contextBuilder: ContextBuilder;
  seedTopic: string;
  courseId: CourseId;
  model: string;
  promptTemplate?: string;
  onComplete: (taxonomy: ScopedTaxonomy) => void;
  onCancel: () => void;
}

export class Stage0Runner {
  private app: App;
  private openRouter: OpenRouterService;
  private contextBuilder: ContextBuilder;
  private seedTopic: string;
  private courseId: CourseId;
  private model: string;
  private promptTemplate?: string;
  private onComplete: (taxonomy: ScopedTaxonomy) => void;
  private onCancel: () => void;

  private taxonomy: TaxonomyNode | null = null;
  private selectedIds: Set<string> = new Set();

  constructor(options: Stage0Options) {
    this.app = options.app;
    this.openRouter = options.openRouter;
    this.contextBuilder = options.contextBuilder;
    this.seedTopic = options.seedTopic;
    this.courseId = options.courseId;
    this.model = options.model;
    this.promptTemplate = options.promptTemplate;
    this.onComplete = options.onComplete;
    this.onCancel = options.onCancel;
  }

  async run(): Promise<void> {
    new Notice('Generating taxonomy...');

    try {
      const prompt = composeStage0Prompt(this.seedTopic, this.promptTemplate);

      const result = await this.openRouter.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json_object',
      });

      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        const retryPrompt = `Your previous response was not valid JSON. Return valid JSON only: ${result.content}`;
        const retryResult = await this.openRouter.chat({
          model: this.model,
          messages: [{ role: 'user', content: retryPrompt }],
          responseFormat: 'json_object',
        });
        parsed = JSON.parse(retryResult.content);
      }

      this.taxonomy = validateScopedTaxonomy(parsed).root;

      this.showTaxonomyView();
    } catch (error) {
      new Notice(`Taxonomy generation failed: ${(error as Error).message}`);
      this.onCancel();
    }
  }

  private showTaxonomyView(): void {
    if (!this.taxonomy) return;

    const modalEl = document.body.createDiv();
    modalEl.style.position = 'fixed';
    modalEl.style.top = '0';
    modalEl.style.left = '0';
    modalEl.style.right = '0';
    modalEl.style.bottom = '0';
    modalEl.style.background = 'var(--background)';
    modalEl.style.zIndex = '1000';
    modalEl.style.overflowY = 'auto';
    modalEl.style.padding = '20px';

    const contentEl = modalEl.createDiv('taxonomy-content');
    contentEl.style.maxWidth = '800px';
    contentEl.style.margin = '0 auto';

    const closeBtn = modalEl.createEl('button', { text: '✕' });
    closeBtn.style.position = 'fixed';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.zIndex = '1001';
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modalEl);
      this.onCancel();
    });

    const view = createTaxonomyView({
      container: contentEl,
      nodes: this.taxonomy,
      selectedIds: this.selectedIds,
      onSelectionChange: (ids) => {
        this.selectedIds = new Set(ids);
      },
      onContinue: () => {
        if (this.taxonomy && hasAtLeastOneLeafSelected(this.taxonomy, this.selectedIds)) {
          this.complete();
          document.body.removeChild(modalEl);
        }
      },
    });
  }

  private complete(): void {
    if (!this.taxonomy) return;

    const scopedTaxonomy: ScopedTaxonomy = {
      courseId: this.courseId,
      root: this.taxonomy,
      selectedIds: Array.from(this.selectedIds),
    };

    new Notice(`Selected ${this.selectedIds.size} topics`);
    this.onComplete(scopedTaxonomy);
  }
}

export async function runStage0(
  app: App,
  openRouter: OpenRouterService,
  contextBuilder: ContextBuilder,
  courseId: CourseId,
  config?: { model?: string; promptTemplate?: string }
): Promise<ScopedTaxonomy | null> {
  return new Promise((resolve) => {
    let runner: Stage0Runner | null = null;

    const modal = new TopicInputModal(app, (seedTopic) => {
      runner = new Stage0Runner({
        app,
        openRouter,
        contextBuilder,
        seedTopic,
        courseId,
        model: config?.model ?? 'anthropic/claude-3.5-haiku',
        promptTemplate: config?.promptTemplate,
        onComplete: (taxonomy) => resolve(taxonomy),
        onCancel: () => resolve(null),
      });
      runner.run();
    });

    modal.onClose = () => {
      if (!runner) {
        resolve(null);
      }
    };

    modal.open();
  });
}
