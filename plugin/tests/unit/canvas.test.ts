import { describe, it, expect } from 'vitest';
import { generateCanvas } from '../../src/writers/canvas';
import type { Curriculum } from '../../src/interfaces';

describe('canvas', () => {
  const baseCurriculum: Curriculum = {
    courseId: 'ml-basics-123',
    title: 'Machine Learning Fundamentals',
    modules: [
      {
        id: 'module-1',
        title: 'Introduction to ML',
        lessons: [
          {
            id: 'lesson-1',
            title: 'What is Machine Learning?',
            summary: 'An introduction to ML concepts.',
            prerequisiteLessonIds: [],
            relatedConceptIds: ['ml-basics'],
            difficulty: 'intro',
            condensed: false,
          },
          {
            id: 'lesson-2',
            title: 'Types of Learning',
            summary: 'Supervised, unsupervised, reinforcement.',
            prerequisiteLessonIds: ['lesson-1'],
            relatedConceptIds: ['supervised-learning'],
            difficulty: 'intro',
            condensed: false,
          },
        ],
      },
      {
        id: 'module-2',
        title: 'Supervised Learning',
        lessons: [
          {
            id: 'lesson-3',
            title: 'Linear Regression',
            summary: 'Predicting continuous values.',
            prerequisiteLessonIds: ['lesson-2'],
            relatedConceptIds: ['linear-regression'],
            difficulty: 'intermediate',
            condensed: false,
          },
        ],
      },
    ],
  };

  it('generates valid JSON', () => {
    const result = generateCanvas(baseCurriculum);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('produces deterministic output for same input', () => {
    const result1 = generateCanvas(baseCurriculum);
    const result2 = generateCanvas(baseCurriculum);
    expect(result1).toBe(result2);
  });

  it('creates one node per lesson', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { nodes: Array<{ type: string }> };
    expect(result.nodes.filter(n => n.type === 'file')).toHaveLength(3);
  });

  it('uses correct node dimensions (320x200)', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { nodes: Array<{ width: number; height: number }> };
    for (const node of result.nodes) {
      expect(node.width).toBe(320);
      expect(node.height).toBe(200);
    }
  });

  it('places modules in columns with 400px x-step', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { nodes: Array<{ x: number; y: number }> };
    const module1Lessons = result.nodes.filter(n => n.x === 0);
    const module2Lessons = result.nodes.filter(n => n.x === 400);
    expect(module1Lessons.length).toBe(2);
    expect(module2Lessons.length).toBe(1);
  });

  it('places lessons in rows with 240px y-step', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { nodes: Array<{ x: number; y: number }> };
    const col0Nodes = result.nodes.filter(n => n.x === 0).sort((a, b) => a.y - b.y);
    expect(col0Nodes[0].y).toBe(0);
    expect(col0Nodes[1].y).toBe(240);
  });

  it('creates edges from prerequisiteLessonIds', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { edges: Array<{ from: { id: string }; to: { id: string } }> };
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it('edge direction is from bottom of prereq to top of dependent', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { edges: Array<{ from: { side: string }; to: { side: string } }> };
    for (const edge of result.edges) {
      expect(edge.from.side).toBe('bottom');
      expect(edge.to.side).toBe('top');
    }
  });

  it('lesson file paths use slugified module and lesson titles', () => {
    const result = JSON.parse(generateCanvas(baseCurriculum)) as { nodes: Array<{ file: string }> };
    const lesson1 = result.nodes.find(n => n.file.includes('what-is-machine-learning'));
    expect(lesson1).toBeDefined();
    expect(lesson1!.file).toMatch(/^4-Curriculum\/introduction-to-ml\//);
  });

  it('handles curriculum with no prerequisites', () => {
    const curriculumNoPrereqs: Curriculum = {
      courseId: 'test',
      title: 'Test',
      modules: [{
        id: 'm1',
        title: 'Module 1',
        lessons: [{
          id: 'l1',
          title: 'Lesson 1',
          summary: 'Summary',
          prerequisiteLessonIds: [],
          relatedConceptIds: [],
          difficulty: 'intro',
          condensed: false,
        }],
      }],
    };
    const result = JSON.parse(generateCanvas(curriculumNoPrereqs));
    expect(result.edges).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('handles unicode characters in titles', () => {
    const curriculumUnicode: Curriculum = {
      courseId: 'test',
      title: 'Test',
      modules: [{
        id: 'm1',
        title: 'Módulo Uno',
        lessons: [{
          id: 'l1',
          title: 'Lección Uno',
          summary: 'Summary',
          prerequisiteLessonIds: [],
          relatedConceptIds: [],
          difficulty: 'intro',
          condensed: false,
        }],
      }],
    };
    const result = JSON.parse(generateCanvas(curriculumUnicode)) as { nodes: Array<{ file: string }> };
    // ó is stripped by ascii-only slugify, so "Lección" -> "Leccin"
    expect(result.nodes[0].file).toContain('leccin-uno');
  });
});