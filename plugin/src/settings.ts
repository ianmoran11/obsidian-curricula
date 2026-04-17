import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { LlmModel, ModelsCacheSnapshot, OpenRouterService } from './services/openrouter';

export interface CurriculaSettings {
  openRouterApiKey: string;
  defaultModel: string;
  _modelsCache: ModelsCacheSnapshot | null;
  promptOverrides: {
    stage0: string;
    stage1: string;
    stage3: string;
    stage4: string;
  };
}

export const DEFAULT_SETTINGS: CurriculaSettings = {
  openRouterApiKey: '',
  defaultModel: '',
  _modelsCache: null,
  promptOverrides: {
    stage0: '',
    stage1: '',
    stage3: '',
    stage4: '',
  },
};

type SettingsHost = Plugin & {
  applySettings?: (settings: CurriculaSettings) => Promise<void>;
  openRouter?: OpenRouterService;
};

function mergeSettings(data: unknown): CurriculaSettings {
  const saved = (data ?? {}) as Partial<CurriculaSettings>;
  const promptOverrides = (saved.promptOverrides ?? {}) as Partial<CurriculaSettings['promptOverrides']>;

  return {
    openRouterApiKey: saved.openRouterApiKey ?? DEFAULT_SETTINGS.openRouterApiKey,
    defaultModel: saved.defaultModel ?? DEFAULT_SETTINGS.defaultModel,
    _modelsCache: normalizeModelsCache(saved._modelsCache),
    promptOverrides: {
      stage0: promptOverrides.stage0 ?? DEFAULT_SETTINGS.promptOverrides.stage0,
      stage1: promptOverrides.stage1 ?? DEFAULT_SETTINGS.promptOverrides.stage1,
      stage3: promptOverrides.stage3 ?? DEFAULT_SETTINGS.promptOverrides.stage3,
      stage4: promptOverrides.stage4 ?? DEFAULT_SETTINGS.promptOverrides.stage4,
    },
  };
}

function normalizeModelsCache(cache: unknown): ModelsCacheSnapshot | null {
  if (!cache || typeof cache !== 'object') {
    return null;
  }

  const candidate = cache as Partial<ModelsCacheSnapshot>;
  if (!Array.isArray(candidate.data) || typeof candidate.cachedAt !== 'number') {
    return null;
  }

  const data = candidate.data.flatMap((model): LlmModel[] => {
    if (!model || typeof model !== 'object') {
      return [];
    }

    const typedModel = model as Partial<LlmModel>;
    if (
      typeof typedModel.id !== 'string' ||
      typeof typedModel.name !== 'string' ||
      typeof typedModel.contextLength !== 'number'
    ) {
      return [];
    }

    return [{
      id: typedModel.id,
      name: typedModel.name,
      contextLength: typedModel.contextLength,
    }];
  });

  if (data.length === 0) {
    return null;
  }

  return {
    data,
    cachedAt: candidate.cachedAt,
  };
}

export function buildModelOptions(models: LlmModel[], selectedModel: string): Array<{ value: string; label: string }> {
  const options = models.map((model) => ({
    value: model.id,
    label: `${model.name} (${model.id})`,
  }));

  if (selectedModel && !models.some((model) => model.id === selectedModel)) {
    options.unshift({
      value: selectedModel,
      label: `${selectedModel} (manual)`,
    });
  }

  return options;
}

export function pickDefaultModel(models: LlmModel[], selectedModel: string): string {
  const trimmedSelection = selectedModel.trim();
  if (trimmedSelection) {
    return trimmedSelection;
  }

  return models[0]?.id ?? '';
}

export async function refreshModelCache(
  settings: CurriculaSettings,
  openRouter: Pick<OpenRouterService, 'listModels'>
): Promise<CurriculaSettings> {
  const models = await openRouter.listModels({ forceRefresh: true });
  return {
    ...settings,
    defaultModel: pickDefaultModel(models, settings.defaultModel),
    _modelsCache: {
      data: models,
      cachedAt: Date.now(),
    },
  };
}

export async function verifyOpenRouterConnection(
  openRouter: Pick<OpenRouterService, 'listModels'>
): Promise<number> {
  const models = await openRouter.listModels({ forceRefresh: true });
  return models.length;
}

export class CurriculaSettingsTab extends PluginSettingTab {
  private ownerPlugin: SettingsHost;
  private settingsData: CurriculaSettings;

  constructor(app: App, plugin: SettingsHost, settings: CurriculaSettings) {
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
          await this.persistSettings();
        });
      });
  }

  private addModelSection(): void {
    const availableModels = this.settingsData._modelsCache?.data ?? [];
    const modelOptions = buildModelOptions(availableModels, this.settingsData.defaultModel);

    new Setting(this.containerEl)
      .setName('Default Model')
      .setDesc('Model used for curriculum generation. Pick from fetched models or enter one manually below.')
      .addDropdown(dropdown => {
        dropdown.addOption('', '-- Select a model --');
        for (const option of modelOptions) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(this.settingsData.defaultModel);
        dropdown.onChange(async (value) => {
          this.settingsData.defaultModel = value;
          await this.persistSettings();
          this.display();
        });
      });

    new Setting(this.containerEl)
      .setName('Manual Model ID')
      .setDesc('Fallback for models not returned by the API. Example: anthropic/claude-3.5-haiku')
      .addText(text => {
        text.setPlaceholder('anthropic/claude-3.5-haiku');
        text.setValue(this.settingsData.defaultModel);
        text.onChange(async (value) => {
          this.settingsData.defaultModel = value.trim();
          await this.persistSettings();
          this.display();
        });
      });

    new Setting(this.containerEl)
      .setName('Model Actions')
      .setDesc('Refresh the model list from OpenRouter or verify your API key and connectivity.')
      .addButton(button => {
        button.setButtonText('Refresh models');
        button.setIcon('refresh');
        button.onClick(() => {
          void this.handleRefreshModels();
        });
      })
      .addButton(button => {
        button.setButtonText('Test connection');
        button.onClick(() => {
          void this.handleTestConnection();
        });
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
          await this.persistSettings();
        });
      });

    const resetBtn = setting.descEl.createEl('button', { text: 'Reset to default' });
    resetBtn.onclick = async () => {
      this.settingsData.promptOverrides[key] = '';
      await this.persistSettings();
      this.display();
    };
  }

  private async persistSettings(): Promise<void> {
    if (this.ownerPlugin.applySettings) {
      await this.ownerPlugin.applySettings(this.settingsData);
      return;
    }

    await this.ownerPlugin.saveData(this.settingsData);
  }

  private async handleRefreshModels(): Promise<void> {
    if (!this.ownerPlugin.openRouter) {
      new Notice('OpenRouter service is not available.');
      return;
    }

    if (!this.settingsData.openRouterApiKey.trim()) {
      new Notice('Enter an OpenRouter API key before refreshing models.');
      return;
    }

    try {
      this.settingsData = await refreshModelCache(this.settingsData, this.ownerPlugin.openRouter);
      await this.persistSettings();
      this.display();
      new Notice(`Fetched ${this.settingsData._modelsCache?.data.length ?? 0} models from OpenRouter.`);
    } catch (error) {
      new Notice(`Model refresh failed: ${(error as Error).message}`);
    }
  }

  private async handleTestConnection(): Promise<void> {
    if (!this.ownerPlugin.openRouter) {
      new Notice('OpenRouter service is not available.');
      return;
    }

    if (!this.settingsData.openRouterApiKey.trim()) {
      new Notice('Enter an OpenRouter API key before testing the connection.');
      return;
    }

    try {
      const count = await verifyOpenRouterConnection(this.ownerPlugin.openRouter);
      this.settingsData = {
        ...this.settingsData,
        _modelsCache: this.ownerPlugin.openRouter.getModelsCache(),
      };
      await this.persistSettings();
      this.display();
      new Notice(`OpenRouter connection verified. ${count} models available.`);
    } catch (error) {
      new Notice(`OpenRouter connection failed: ${(error as Error).message}`);
    }
  }
}

export async function loadSettings(plugin: Plugin): Promise<CurriculaSettings> {
  try {
    const data = await plugin.loadData();
    return mergeSettings(data);
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return mergeSettings(undefined);
}

export async function saveSettings(plugin: Plugin, settings: CurriculaSettings): Promise<void> {
  await plugin.saveData(settings);
}
