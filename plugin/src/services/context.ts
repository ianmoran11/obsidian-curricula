import { Vault, TFile } from 'obsidian';
import { VAULT_PATHS } from '../constants';

export class ContextTooLargeError extends Error {
  constructor(
    message: string,
    public currentByteLength: number,
    public modelContextLength: number,
    public suggestedModels: string[] = []
  ) {
    super(message);
    this.name = 'ContextTooLargeError';
  }
}

export interface ContextResult {
  text: string;
  files: string[];
  byteLength: number;
  mode: 'grounded' | 'knowledge-only';
}

const KNOWLEDGE_ONLY_PLACEHOLDER = '(no user-provided sources — rely on your general knowledge of the topic)';
const SEPARATOR = '\n\n===== ';
const SEPARATOR_END = ' =====\n\n';

export class ContextBuilder {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async buildContext(modelContextLength: number = 4096): Promise<ContextResult> {
    const markdownPath = VAULT_PATHS.MARKDOWN_SOURCES;
    
    let markdownFiles: TFile[] = [];
    try {
      const root = this.vault.getRoot();
      const targetFolder = this.vault.getAbstractFileByPath(markdownPath);
      
      if (targetFolder) {
        markdownFiles = this.vault.getMarkdownFiles().filter(file => {
          return file.path.startsWith(markdownPath + '/');
        });
      }
    } catch (e) {
      // Fall through to empty case
    }

    if (markdownFiles.length === 0) {
      return {
        text: KNOWLEDGE_ONLY_PLACEHOLDER,
        files: [],
        byteLength: KNOWLEDGE_ONLY_PLACEHOLDER.length,
        mode: 'knowledge-only',
      };
    }

    markdownFiles.sort((a, b) => a.path.localeCompare(b.path));

    const parts: string[] = [];
    const fileNames: string[] = [];
    let totalBytes = 0;

    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        const fileName = file.name;
        parts.push(SEPARATOR + fileName + SEPARATOR_END + content);
        fileNames.push(fileName);
        totalBytes += content.length;
      } catch (e) {
        // Skip files that can't be read
        continue;
      }

      if (parts.length > 20) {
        await yieldToMicrotask();
      }
    }

    const text = parts.join('');

    if (totalBytes > modelContextLength * 3) {
      const availableModels = this.getHigherContextModels();
      throw new ContextTooLargeError(
        `Context too large: ${totalBytes} bytes exceeds limit of ${modelContextLength * 3} bytes (~${modelContextLength} tokens × 3). Please pick a larger-context model or trim sources.`,
        totalBytes,
        modelContextLength,
        availableModels
      );
    }

    return {
      text,
      files: fileNames,
      byteLength: totalBytes,
      mode: 'grounded',
    };
  }

  private getHigherContextModels(): string[] {
    return [
      'anthropic/claude-3.5-sonnet-200k',
      'openai/gpt-4-turbo-128k',
      'mistral/mistral-large-200k',
    ];
  }

  async buildKnowledgeOnlyContext(): Promise<ContextResult> {
    return {
      text: KNOWLEDGE_ONLY_PLACEHOLDER,
      files: [],
      byteLength: KNOWLEDGE_ONLY_PLACEHOLDER.length,
      mode: 'knowledge-only',
    };
  }
}

function yieldToMicrotask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function isContextTooLargeError(e: unknown): e is ContextTooLargeError {
  return e instanceof ContextTooLargeError;
}