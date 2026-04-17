export class App {}

export class Modal {
  contentEl: {
    empty: () => void;
    createDiv: () => unknown;
    createEl: () => unknown;
  };

  constructor(_app?: unknown) {
    const contentEl = {
      empty() {},
      createDiv() {
        return contentEl;
      },
      createEl() {
        return contentEl;
      },
    };

    this.contentEl = contentEl;
  }

  onOpen(): void {}

  onClose(): void {}

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }
}

export class Notice {
  constructor(_message: string) {}
}

export class ButtonComponent {
  setButtonText(_text: string): this {
    return this;
  }

  onClick(_callback: () => void): this {
    return this;
  }
}

export class Plugin {}

export class PluginSettingTab {}

export class Setting {}

export class TFile {
  path = '';
  name = '';
}

export class Vault {
  getRoot(): unknown {
    return null;
  }

  getAbstractFileByPath(_path: string): unknown {
    return null;
  }

  getMarkdownFiles(): TFile[] {
    return [];
  }

  async read(_file: TFile): Promise<string> {
    return '';
  }
}

export class DataAdapter {}

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isAndroidApp: false,
};

export async function requestUrl(): Promise<never> {
  throw new Error('requestUrl mock not implemented');
}
