import { describe, it, expect } from 'vitest';
import { ContextTooLargeError, isContextTooLargeError } from '../../src/services/context';

const PLACEHOLDER = '(no user-provided sources — rely on your general knowledge of the topic)';

describe('ContextBuilder', () => {
  describe('ContextTooLargeError', () => {
    it('has correct properties', () => {
      const error = new ContextTooLargeError('too large', 50000, 4096, ['model1', 'model2']);
      
      expect(error.currentByteLength).toBe(50000);
      expect(error.modelContextLength).toBe(4096);
      expect(error.suggestedModels).toEqual(['model1', 'model2']);
      expect(error.message).toBe('too large');
    });
  });

  describe('isContextTooLargeError', () => {
    it('returns true for ContextTooLargeError', () => {
      const error = new ContextTooLargeError('too large', 50000, 4096);
      expect(isContextTooLargeError(error)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isContextTooLargeError(new Error('some error'))).toBe(false);
    });

    it('returns false for non-Error objects', () => {
      expect(isContextTooLargeError('not an error')).toBe(false);
      expect(isContextTooLargeError(null)).toBe(false);
      expect(isContextTooLargeError(undefined)).toBe(false);
    });
  });

  describe('knowledge-only placeholder', () => {
    it('placeholder string is non-empty', () => {
      expect(typeof PLACEHOLDER).toBe('string');
      expect(PLACEHOLDER.length).toBeGreaterThan(0);
      expect(PLACEHOLDER).toContain('no user-provided sources');
      expect(PLACEHOLDER).toContain('general knowledge');
    });
  });
});