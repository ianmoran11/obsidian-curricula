import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface CurriculaSettings {
  openRouterApiKey: string;
  defaultModel: string;
  promptOverrides: {
    stage0: string;
    stage1: string;
    stage3: string;
    stage4: string;
  };
}

const DEFAULT_SETTINGS: CurriculaSettings = {
  openRouterApiKey: '',
  defaultModel: '',
  promptOverrides: {
    stage0: '',
    stage1: '',
    stage3: '',
    stage4: '',
  },
};

export class CurriculaSettingsTab extends PluginSettingTab {
  private ownerPlugin: Plugin;
  private settingsData: CurriculaSettings;

  constructor(app: App, plugin: Plugin, settings: CurriculaSettings) {
    super(app, plugin);
    this.ownerPlugin = plugin;
    this.settingsData = settings;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Curricula Settings' });

    this.addApiKeySection();
    this.addModelSection();
    this.addPromptSection('Stage 0 - Taxonomy', 'stage0', this.settingsData.promptOverrides.stage0);
    this.addPromptSection('Stage 1 - Concepts', 'stage1', this.settingsData.promptOverrides.stage1);
    this.addPromptSection('Stage 3 - Curriculum', 'stage3', this.settingsData.promptOverrides.stage3);
    this.addPromptSection('Stage 4 - Lesson', 'stage4', this.settingsData.promptOverrides.stage4);
  }

  private addApiKeySection(): void {
    new Setting(this.containerEl)
      .setName('OpenRouter API Key')
      .setDesc('Your API key for OpenRouter. Get one at openrouter.ai')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setValue(this.settingsData.openRouterApiKey);
        text.onChange(async (value) => {
          this.settingsData.openRouterApiKey = value;
          await this.ownerPlugin.saveData(this.settingsData);
        });
      });
  }

  private addModelSection(): void {
    new Setting(this.containerEl)
      .setName('Default Model')
      .setDesc('Model used for curriculum generation. Refresh models after completing Task 10.')
      .addDropdown(dropdown => {
        dropdown.addOption('', '-- Select a model --');
        if (this.settingsData.defaultModel) {
          dropdown.addOption(this.settingsData.defaultModel, this.settingsData.defaultModel);
        }
        dropdown.onChange(async (value) => {
          if (value) {
            this.settingsData.defaultModel = value;
            await this.ownerPlugin.saveData(this.settingsData);
          }
        });
      });

    new Setting(this.containerEl)
      .setName('Refresh Models')
      .setDesc('Fetch available models from OpenRouter (available after Task 10)')
      .addButton(button => {
        button.setTooltip('Complete Task 10 to enable model listing');
        button.setDisabled(true);
        button.setIcon('refresh');
      });
  }

  private addPromptSection(title: string, key: 'stage0' | 'stage1' | 'stage3' | 'stage4', value: string): void {
    const setting = new Setting(this.containerEl)
      .setName(title)
      .setDesc('Leave empty to use default prompt')
      .addTextArea(text => {
        text.inputEl.rows = 6;
        text.setValue(value);
        text.onChange(async (val) => {
          this.settingsData.promptOverrides[key] = val;
          await this.ownerPlugin.saveData(this.settingsData);
        });
      });

    const resetBtn = setting.descEl.createEl('button', { text: 'Reset to default' });
    resetBtn.onclick = async () => {
      this.settingsData.promptOverrides[key] = '';
      await this.ownerPlugin.saveData(this.settingsData);
      this.display();
    };
  }
}

export function loadSettings(plugin: Plugin): CurriculaSettings {
  const defaultSettings = { ...DEFAULT_SETTINGS };
  try {
    const data = plugin.loadData();
    if (data) {
      return { ...defaultSettings, ...data };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return defaultSettings;
}

export async function saveSettings(plugin: Plugin, settings: CurriculaSettings): Promise<void> {
  await plugin.saveData(settings);
}