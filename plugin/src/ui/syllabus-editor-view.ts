import type { Curriculum } from '../interfaces';

export interface SyllabusEditorOptions {
  container: HTMLElement;
  curriculum: Curriculum;
  onSave: (curriculum: Curriculum) => void;
  onCancel: () => void;
}

export class SyllabusEditor {
  private container: HTMLElement;
  private curriculum: Curriculum;
  private onSave: (curriculum: Curriculum) => void;
  private onCancel: () => void;
  private modules: HTMLElement[] = [];

  constructor(options: SyllabusEditorOptions) {
    this.container = options.container;
    this.curriculum = JSON.parse(JSON.stringify(options.curriculum));
    this.onSave = options.onSave;
    this.onCancel = options.onCancel;
    this.render();
  }

  private render(): void {
    this.container.empty();

    const header = this.container.createDiv('syllabus-header');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

    header.createEl('h2', { text: this.curriculum.title || 'Edit Curriculum' });

    const buttonRow = header.createDiv('button-row');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '8px';

    const finalizeBtn = buttonRow.createEl('button', { text: 'Finalize' });
    finalizeBtn.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
      display: flex;
      align-items: center;
    `;
    finalizeBtn.addEventListener('click', () => this.handleFinalize());

    const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--border-color);
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
    `;
    cancelBtn.addEventListener('click', () => this.onCancel());

    const modulesContainer = this.container.createDiv('modules-container');
    modulesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

    for (let i = 0; i < this.curriculum.modules.length; i++) {
      const moduleEl = this.renderModule(this.curriculum.modules[i], i);
      modulesContainer.appendChild(moduleEl);
    }
  }

  private renderModule(module: Curriculum['modules'][0], moduleIndex: number): HTMLElement {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'module';
    moduleEl.style.cssText = `
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      background: var(--background-secondary);
    `;

    const header = moduleEl.createDiv('module-header');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

    const titleInput = header.createEl('input', { type: 'text', value: module.title }) as HTMLInputElement;
    titleInput.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px 8px;
      background: transparent;
      color: var(--text);
      flex: 1;
    `;
    titleInput.addEventListener('change', () => {
      module.title = titleInput.value;
    });

    const deleteModuleBtn = header.createEl('button', { text: '✕' });
    deleteModuleBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 18px;
      padding: 8px 12px;
      min-width: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    deleteModuleBtn.addEventListener('click', () => {
      moduleEl.remove();
      this.curriculum.modules.splice(this.curriculum.modules.indexOf(module), 1);
    });

    const lessonsContainer = moduleEl.createDiv('lessons-container');
    lessonsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    for (let j = 0; j < module.lessons.length; j++) {
      const lessonEl = this.renderLesson(module.lessons[j], module);
      lessonsContainer.appendChild(lessonEl);
    }

    const addLessonBtn = lessonsContainer.createEl('button', { text: '+ Add Lesson' });
    addLessonBtn.style.cssText = `
      background: transparent;
      border: 1px dashed var(--border-color);
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      color: var(--text-muted);
      min-height: 48px;
    `;
    addLessonBtn.addEventListener('click', () => {
      const newLesson: Curriculum['modules'][0]['lessons'][0] = {
        id: `lesson-${Date.now()}`,
        title: 'New Lesson',
        summary: '',
        prerequisiteLessonIds: [],
        relatedConceptIds: [],
        difficulty: 'intro',
        condensed: false,
      };
      module.lessons.push(newLesson);
      const lessonEl = this.renderLesson(newLesson, module);
      lessonsContainer.insertBefore(lessonEl, addLessonBtn);
    });

    return moduleEl;
  }

  private renderLesson(
    lesson: Curriculum['modules'][0]['lessons'][0],
    module: Curriculum['modules'][0]
  ): HTMLElement {
    const lessonEl = document.createElement('div');
    lessonEl.className = 'lesson';
    lessonEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--background);
    `;

    const dragHandle = lessonEl.createEl('span', { text: '☰' });
    dragHandle.style.cssText = `
      cursor: grab;
      color: var(--text-muted);
      font-size: 14px;
      min-width: 24px;
      min-height: 48px;
      display: flex;
      align-items: center;
    `;

    const checkbox = lessonEl.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
    checkbox.checked = !lesson.condensed;
    checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    checkbox.addEventListener('change', () => {
      lesson.condensed = !checkbox.checked;
    });

    const titleInput = lessonEl.createEl('input', { type: 'text', value: lesson.title }) as HTMLInputElement;
    titleInput.style.cssText = `
      flex: 1;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 4px 8px;
      background: transparent;
      color: var(--text);
      min-height: 48px;
    `;
    titleInput.addEventListener('change', () => {
      lesson.title = titleInput.value;
    });

    const difficultyChip = lessonEl.createEl('span', { text: lesson.difficulty });
    difficultyChip.style.cssText = `
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      text-transform: capitalize;
    `;

    const deleteBtn = lessonEl.createEl('button', { text: '✕' });
    deleteBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      padding: 8px 12px;
      min-width: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    deleteBtn.addEventListener('click', () => {
      lessonEl.remove();
      module.lessons.splice(module.lessons.indexOf(lesson), 1);
    });

    return lessonEl;
  }

  private handleFinalize(): void {
    this.onSave(this.curriculum);
  }
}

export function createSyllabusEditor(options: SyllabusEditorOptions): SyllabusEditor {
  return new SyllabusEditor(options);
}