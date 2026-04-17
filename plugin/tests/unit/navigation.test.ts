import { describe, it, expect } from 'vitest';
import { buildBreadcrumb, buildPrevNext } from '../../src/writers/navigation';

describe('navigation writer', () => {
  describe('buildBreadcrumb', () => {
    it('creates correct breadcrumb format', () => {
      const result = buildBreadcrumb(
        '4-Curriculum/Course Index.md',
        '4-Curriculum/supervised-learning/supervised-learning MOC.md',
        'Supervised Learning'
      );
      expect(result).toContain('[[4-Curriculum/Course Index|Course Index]]');
      expect(result).toContain(
        '[[4-Curriculum/supervised-learning/supervised-learning MOC|Supervised Learning]]'
      );
    });
  });

  describe('buildPrevNext', () => {
    it('includes next pointing to course index when no next lesson', () => {
      const prev = { title: 'Lesson 1', filePath: '4-Curriculum/module-1/lesson-1.md' };
      const result = buildPrevNext(prev, null, '4-Curriculum/Course Index.md');
      expect(result).toContain('Previous:');
      expect(result).toContain('[[4-Curriculum/Course Index|Course Index]]');
    });

    it('includes both prev and next when both exist', () => {
      const prev = { title: 'Lesson 1', filePath: '4-Curriculum/module-1/lesson-1.md' };
      const next = { title: 'Lesson 3', filePath: '4-Curriculum/module-2/lesson-3.md' };
      const result = buildPrevNext(prev, next, '4-Curriculum/Course Index.md');
      expect(result).toContain('Previous:');
      expect(result).toContain('Next:');
      expect(result).toContain('[[4-Curriculum/module-1/lesson-1|Lesson 1]]');
      expect(result).toContain('[[4-Curriculum/module-2/lesson-3|Lesson 3]]');
    });

    it('works with only next lesson', () => {
      const result = buildPrevNext(
        null,
        { title: 'Lesson 2', filePath: '4-Curriculum/module-1/lesson-2.md' },
        '4-Curriculum/Course Index.md'
      );
      expect(result).toContain('Next:');
      expect(result).not.toContain('Previous:');
    });

    it('uses deterministic paths for duplicate and normalized lesson titles', () => {
      const prev = { title: 'Intro / Setup', filePath: '4-Curriculum/foundations/intro-setup.md' };
      const next = { title: 'Intro / Setup', filePath: '4-Curriculum/foundations/intro-setup-2.md' };
      const result = buildPrevNext(prev, next, '4-Curriculum/Course Index.md');

      expect(result).toContain('[[4-Curriculum/foundations/intro-setup|Intro / Setup]]');
      expect(result).toContain('[[4-Curriculum/foundations/intro-setup-2|Intro / Setup]]');
    });
  });
});
