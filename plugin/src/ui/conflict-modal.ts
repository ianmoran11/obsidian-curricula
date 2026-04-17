import { App, Modal, ButtonComponent } from 'obsidian';
import type { LockInfo } from '../services/lock';

export interface ConflictModalOptions {
  app: App;
  lockInfo: LockInfo;
  onCancel: () => void;
  onOverride?: () => void;
}

export class ConflictModal extends Modal {
  private lockInfo: LockInfo;
  private onCancel: () => void;
  private onOverride?: () => void;

  constructor(options: ConflictModalOptions) {
    super(options.app);
    this.lockInfo = options.lockInfo;
    this.onCancel = options.onCancel;
    this.onOverride = options.onOverride;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const coverMode = contentEl.offsetWidth < 500;

    contentEl.createEl('h2', { text: 'Generation Already In Progress' });

    const message = contentEl.createDiv('conflict-message');
    message.style.marginTop = '16px';
    message.style.lineHeight = '1.6';

    message.createEl('p', {
      text: `Another device is currently generating this curriculum.`,
    });

    const deviceInfo = contentEl.createDiv('device-info');
    deviceInfo.style.marginTop = '12px';
    deviceInfo.style.padding = '12px';
    deviceInfo.style.background = 'var(--background-secondary)';
    deviceInfo.style.borderRadius = '6px';

    deviceInfo.createEl('p', {
      text: `Device: ${this.lockInfo.deviceName}`,
    });

    const startedDate = new Date(this.lockInfo.startedAt);
    deviceInfo.createEl('p', {
      text: `Started: ${startedDate.toLocaleString()}`,
    });

    const buttonRow = contentEl.createDiv('button-row');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexDirection = coverMode ? 'column' : 'row';
    buttonRow.style.gap = '8px';
    buttonRow.style.marginTop = '24px';

    const cancelButton = new ButtonComponent(buttonRow);
    cancelButton.setButtonText('Cancel');
    cancelButton.onClick(() => {
      this.close();
      this.onCancel();
    });

    if (this.onOverride) {
      const overrideButton = new ButtonComponent(buttonRow);
      overrideButton.setButtonText('Override (Dangerous)');
      overrideButton.setWarning();
      overrideButton.onClick(() => {
        this.close();
        this.onOverride?.();
      });
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export function showConflictModal(options: ConflictModalOptions): void {
  new ConflictModal(options).open();
}
