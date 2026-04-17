import { Notice, App } from 'obsidian';
import { OpenRouterService } from '../services/openrouter';
import { ContextBuilder } from '../services/context';
import { validateCurriculum } from '../services/validator';
import { composeStage3Prompt } from '../prompts';
import type { ScopedTaxonomy, ConceptList, ProficiencyMap, Curriculum, CourseId } from '../interfaces';
import type { LockService } from '../services/lock';
import { showConflictModal } from '../ui/conflict-modal';

export interface Stage3Options {
  app: App;
  openRouter: OpenRouterService;
  contextBuilder: ContextBuilder;
  taxonomy: ScopedTaxonomy;
  concepts: ConceptList;
  proficiency: ProficiencyMap;
  courseId: CourseId;
  lockService?: LockService;
  model: string;
  modelContextLength: number;
  promptTemplate?: string;
  onComplete: (curriculum: Curriculum) => void;
  onError: (error: Error) => void;
}

export async function runStage3(options: Stage3Options): Promise<Curriculum | null> {
  new Notice('Designing curriculum...');

  try {
    if (options.lockService) {
      const lockState = await options.lockService.isLockedByAnother(options.courseId);
      if (lockState.locked && lockState.info) {
        showConflictModal({
          app: options.app,
          lockInfo: lockState.info,
          onCancel: () => {
            options.onError(new Error('Cancelled: generation in progress on another device'));
          },
        });
        return null;
      }
    }

    const contextResult = await options.contextBuilder.buildContext(options.modelContextLength);

    const prompt = composeStage3Prompt(
      options.taxonomy.selectedIds,
      options.concepts.concepts,
      options.proficiency,
      contextResult.text,
      options.promptTemplate
    );

    const result = await options.openRouter.chat({
      model: options.model,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json_object',
      temperature: 0.3,
    });

    let parsed: Curriculum;
    try {
      parsed = validateCurriculum(JSON.parse(result.content));
    } catch {
      const retryPrompt = `Your previous response failed validation. Return valid JSON only matching the Curriculum schema. ${result.content}`;
      const retryResult = await options.openRouter.chat({
        model: options.model,
        messages: [{ role: 'user', content: retryPrompt }],
        responseFormat: 'json_object',
        temperature: 0.3,
      });
      parsed = validateCurriculum(JSON.parse(retryResult.content));
    }

    const curriculum: Curriculum = {
      courseId: options.courseId,
      title: parsed.title,
      modules: parsed.modules,
    };

    new Notice(`Curriculum ready: ${curriculum.modules.length} modules`);
    options.onComplete(curriculum);
    return curriculum;
  } catch (error) {
    new Notice(`Curriculum design failed: ${(error as Error).message}`);
    options.onError(error as Error);
    return null;
  }
}
