import { App, Notice } from 'obsidian';
import { LikertModal } from '../ui/likert-modal';
import type { ConceptList, ProficiencyMap, CourseId } from '../interfaces';

export interface Stage2Options {
  app: App;
  concepts: ConceptList;
  courseId: CourseId;
  onComplete: (proficiency: ProficiencyMap) => void;
  onError: (error: Error) => void;
}

export async function runStage2(options: Stage2Options): Promise<ProficiencyMap | null> {
  return new Promise((resolve) => {
    const modal = new LikertModal({
      app: options.app,
      concepts: options.concepts.concepts,
      courseId: options.courseId,
      onComplete: (proficiency) => {
        resolve(proficiency);
      },
      onCancel: () => {
        resolve(null);
      },
    });

    modal.open();
  });
}