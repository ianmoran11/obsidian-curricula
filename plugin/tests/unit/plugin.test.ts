import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('plugin command wiring', () => {
  const pluginSource = readFileSync(resolve(__dirname, '../../src/plugin.ts'), 'utf8');

  it('removes the coming-soon placeholder notice', () => {
    expect(pluginSource).not.toContain('Start New Course - coming soon');
  });

  it('routes both the command and ribbon through startNewCourse orchestration', () => {
    const matches = pluginSource.match(/void this\.startNewCourse\(\);/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(pluginSource).toContain('await runStage0(');
    expect(pluginSource).toContain('await this.runStage1Flow(');
    expect(pluginSource).toContain('await runStage2(');
    expect(pluginSource).toContain('await this.runStage3Flow(');
    expect(pluginSource).toContain('await this.runStage4Flow(');
  });

  it('uses atomic vault writes and exposes an explicit resume path', () => {
    expect(pluginSource).toContain("const tmpPath = `${path}.tmp`;");
    expect(pluginSource).toContain('await this.app.vault.adapter.rename(tmpPath, path);');
    expect(pluginSource).toContain('await this.resumeCourse(resumeInfo);');
    expect(pluginSource).toContain('new ResumePromptModal(');
  });
});
