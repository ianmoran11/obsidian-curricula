import { describe, it, expect } from 'vitest';
import { buildBreadcrumb, buildPrevNext } from '../../src/writers/navigation';

describe('navigation writer', () => {
  describe('buildBreadcrumb', () => {
    it('creates correct breadcrumb format', () => {
      const result = buildBreadcrumb('Machine Learning', 'Supervised Learning', 'Classification');
      expect(result).toContain('[[Course Index]]');
      expect(result).toContain('[[Supervised Learning]]');
    });
  });

  describe('buildPrevNext', () => {
    it('includes next pointing to course index when no next lesson', () => {
      const prev = { title: 'Lesson 1', filePath: '/path/lesson-1.md' };
      const result = buildPrevNext(prev, null, 'Course Index.md');
      expect(result).toContain('Previous:');
      expect(result).toContain('[[Course Index]]');
    });

    it('includes both prev and next when both exist', () => {
      const prev = { title: 'Lesson 1', filePath: '/path/lesson-1.md' };
      const next = { title: 'Lesson 3', filePath: '/path/lesson-3.md' };
      const result = buildPrevNext(prev, next, 'Course Index.md');
      expect(result).toContain('Previous:');
      expect(result).toContain('Next:');
      expect(result).toContain('Lesson 1');
      expect(result).toContain('Lesson 3');
    });

    it('works with only next lesson', () => {
      const result = buildPrevNext(null, { title: 'Lesson 2', filePath: '/path/lesson-2.md' }, 'Course Index.md');
      expect(result).toContain('Next:');
      expect(result).not.toContain('Previous:');
    });
  });
});