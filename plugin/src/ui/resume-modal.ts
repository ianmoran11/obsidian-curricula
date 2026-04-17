import { ButtonComponent, Modal } from 'obsidian';

export interface ResumePromptOptions {
  courseLabel: string;
  stageLabel: string;
  onResume: () => void;
  onDismiss: () => void;
}

export class ResumePromptModal extends Modal {
  private readonly courseLabel: string;
  private readonly stageLabel: string;
  private readonly onResume: () => void;
  private readonly onDismiss: () => void;

  constructor(app: Modal['app'], options: ResumePromptOptions) {
    super(app);
    this.courseLabel = options.courseLabel;
    this.stageLabel = options.stageLabel;
    this.onResume = options.onResume;
    this.onDismiss = options.onDismiss;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Resume course' });
    contentEl.createEl('p', {
      text: `Resume ${this.courseLabel} from ${this.stageLabel}?`,
    });

    const buttonRow = contentEl.createDiv();
    buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;';

    const dismissButton = new ButtonComponent(buttonRow);
    dismissButton.setButtonText('Later');
    dismissButton.onClick(() => {
      this.close();
      this.onDismiss();
    });

    const resumeButton = new ButtonComponent(buttonRow);
    resumeButton.setButtonText('Resume');
    resumeButton.setCta();
    resumeButton.onClick(() => {
      this.close();
      this.onResume();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
