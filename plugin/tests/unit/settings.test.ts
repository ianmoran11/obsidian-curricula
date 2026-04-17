import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('settings persistence', () => {
  it('loads persisted settings asynchronously and deep-merges prompt overrides', () => {
    const settingsSource = readFileSync(resolve(__dirname, '../../src/settings.ts'), 'utf8');

    expect(settingsSource).toContain('export async function loadSettings');
    expect(settingsSource).toContain('const data = await plugin.loadData();');
    expect(settingsSource).toContain('_modelsCache: normalizeModelsCache(saved._modelsCache)');
    expect(settingsSource).toContain("stage0: promptOverrides.stage0 ?? DEFAULT_SETTINGS.promptOverrides.stage0");
    expect(settingsSource).toContain("stage1: promptOverrides.stage1 ?? DEFAULT_SETTINGS.promptOverrides.stage1");
    expect(settingsSource).toContain("stage3: promptOverrides.stage3 ?? DEFAULT_SETTINGS.promptOverrides.stage3");
    expect(settingsSource).toContain("stage4: promptOverrides.stage4 ?? DEFAULT_SETTINGS.promptOverrides.stage4");
  });

  it('uses persisted settings during startup and stage orchestration', () => {
    const pluginSource = readFileSync(resolve(__dirname, '../../src/plugin.ts'), 'utf8');

    expect(pluginSource).toContain('this.settings = await loadSettings(this);');
    expect(pluginSource).toContain('async applySettings(settings: CurriculaSettings): Promise<void>');
    expect(pluginSource).toContain('this.openRouter.updateConfig({');
    expect(pluginSource).toContain('this.openRouter.hydrateModelsCache(this.settings._modelsCache);');
    expect(pluginSource).toContain('apiKey: this.settings.openRouterApiKey');
    expect(pluginSource).toContain('await this.saveData(this.settings);');
    expect(pluginSource).toContain('model: this.getActiveModel()');
    expect(pluginSource).toContain("promptTemplate: this.getPromptTemplate('stage0')");
    expect(pluginSource).toContain("promptTemplate: this.getPromptTemplate('stage1')");
    expect(pluginSource).toContain("promptTemplate: this.getPromptTemplate('stage3')");
  });
});
