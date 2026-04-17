import { App, Notice } from 'obsidian';
import { OpenRouterService } from '../services/openrouter';
import { ContextBuilder } from '../services/context';
import { validateConceptList } from '../services/validator';
import { composeStage1Prompt } from '../prompts';
import type { ScopedTaxonomy, ConceptList, CourseId } from '../interfaces';

export interface Stage1Options {
  app: App;
  openRouter: OpenRouterService;
  contextBuilder: ContextBuilder;
  taxonomy: ScopedTaxonomy;
  courseId: CourseId;
  modelContextLength: number;
  onComplete: (concepts: ConceptList) => void;
  onError: (error: Error) => void;
}

export class Stage1Runner {
  private app: App;
  private openRouter: OpenRouterService;
  private contextBuilder: ContextBuilder;
  private taxonomy: ScopedTaxonomy;
  private courseId: CourseId;
  private modelContextLength: number;
  private onComplete: (concepts: ConceptList) => void;
  private onError: (error: Error) => void;

  constructor(options: Stage1Options) {
    this.app = options.app;
    this.openRouter = options.openRouter;
    this.contextBuilder = options.contextBuilder;
    this.taxonomy = options.taxonomy;
    this.courseId = options.courseId;
    this.modelContextLength = options.modelContextLength;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  async run(): Promise<void> {
    new Notice('Extracting concepts...');

    try {
      const contextResult = await this.contextBuilder.buildContext(this.modelContextLength);

      const prompt = composeStage1Prompt(
        this.taxonomy.selectedIds,
        contextResult.text
      );

      const result = await this.openRouter.chat({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json_object',
        temperature: 0.3,
      });

      let parsed: ConceptList;
      try {
        parsed = validateConceptList(JSON.parse(result.content));
      } catch {
        const retryPrompt = `Your previous response failed validation. Return valid JSON only matching the ConceptList schema. ${result.content}`;
        const retryResult = await this.openRouter.chat({
          model: 'anthropic/claude-3.5-haiku',
          messages: [{ role: 'user', content: retryPrompt }],
          responseFormat: 'json_object',
          temperature: 0.3,
        });
        parsed = validateConceptList(JSON.parse(retryResult.content));
      }

      if (parsed.concepts.length < 15 || parsed.concepts.length > 40) {
        new Notice(`Warning: ${parsed.concepts.length} concepts extracted (expected 15-40)`);
      }

      const conceptList: ConceptList = {
        courseId: this.courseId,
        concepts: parsed.concepts,
      };

      new Notice(`Extracted ${conceptList.concepts.length} concepts`);
      this.onComplete(conceptList);
    } catch (error) {
      new Notice(`Concept extraction failed: ${(error as Error).message}`);
      this.onError(error as Error);
    }
  }
}

export async function runStage1(
  options: Stage1Options
): Promise<ConceptList | null> {
  const runner = new Stage1Runner(options);
  return new Promise((resolve) => {
    runner.run().then(() => {
      resolve(null);
    }).catch(() => {
      resolve(null);
    });
  });
}