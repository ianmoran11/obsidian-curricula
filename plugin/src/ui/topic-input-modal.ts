import { App, Modal, ButtonComponent } from 'obsidian';

export class TopicInputModal extends Modal {
  private onSubmit: (seedTopic: string) => void;
  private inputEl!: HTMLInputElement;
  private submitButton!: ButtonComponent;
  private errorEl!: HTMLElement;

  constructor(app: App, onSubmit: (seedTopic: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const coverMode = contentEl.offsetWidth < 500;

    contentEl.createEl('h2', { text: 'Start New Course' });

    contentEl.createEl('p', {
      text: 'Enter a seed topic for your curriculum (e.g., "Machine Learning", "Guitar", "World War II"):',
    });

    this.errorEl = contentEl.createDiv('error-message');
    this.errorEl.style.color = 'var(--text-error)';
    this.errorEl.style.display = 'none';

    const inputWrapper = contentEl.createDiv('input-wrapper');
    this.inputEl = inputWrapper.createEl('input', {
      type: 'text',
      placeholder: 'e.g., Machine Learning',
      cls: 'topic-input',
    }) as HTMLInputElement;
    this.inputEl.style.width = '100%';
    this.inputEl.style.padding = '12px';
    this.inputEl.style.margin = '8px 0';
    this.inputEl.style.minHeight = '48px';
    this.inputEl.style.fontSize = '16px';

    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.handleSubmit();
      }
    });

    const buttonRow = contentEl.createDiv('button-row');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexDirection = coverMode ? 'column' : 'row';
    buttonRow.style.gap = '8px';
    buttonRow.style.marginTop = '16px';

    this.submitButton = new ButtonComponent(buttonRow);
    this.submitButton.setButtonText('Generate Taxonomy');
    this.submitButton.setCta();
    this.submitButton.onClick(() => this.handleSubmit());

    const cancelButton = new ButtonComponent(buttonRow);
    cancelButton.setButtonText('Cancel');
    cancelButton.onClick(() => this.close());

    setTimeout(() => this.inputEl.focus(), 100);
  }

  private handleSubmit(): void {
    const value = this.inputEl.value.trim();

    if (!value) {
      this.errorEl.setText('Please enter a topic');
      this.errorEl.style.display = 'block';
      return;
    }

    this.errorEl.style.display = 'none';
    this.onSubmit(value);
    this.close();
  }
}