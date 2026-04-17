import { describe, it, expect } from 'vitest';
import { buildFrontmatter } from '../../src/writers/frontmatter';

describe('frontmatter', () => {
  it('builds basic frontmatter with string values', () => {
    const result = buildFrontmatter({ title: 'My Lesson', status: 'unread' });
    expect(result).toContain('title: My Lesson');
    expect(result).toContain('status: unread');
  });

  it('wraps strings with colons in quotes', () => {
    const result = buildFrontmatter({ title: 'Lesson: Introduction' });
    expect(result).toContain('title: "Lesson: Introduction"');
  });

  it('wraps strings with quotes in quotes and escapes them', () => {
    const result = buildFrontmatter({ title: 'He said "hello"' });
    expect(result).toContain('title: "He said \\"hello\\""');
  });

  it('wraps strings with single quotes in quotes', () => {
    const result = buildFrontmatter({ title: "It's a lesson" });
    expect(result).toContain("title: \"It's a lesson\"");
  });

  it('escapes newlines in strings', () => {
    const result = buildFrontmatter({ summary: 'Line one\nLine two' });
    expect(result).toContain('summary: "Line one\\nLine two"');
  });

  it('escapes backslashes in strings', () => {
    const result = buildFrontmatter({ path: 'C:\\Users\\test' });
    expect(result).toContain('path: "C:\\\\Users\\\\test"');
  });

  it('handles boolean values', () => {
    const result = buildFrontmatter({ condensed: true, active: false });
    expect(result).toContain('condensed: true');
    expect(result).toContain('active: false');
  });

  it('handles numeric values', () => {
    const result = buildFrontmatter({ order: 1, score: 95 });
    expect(result).toContain('order: 1');
    expect(result).toContain('score: 95');
  });

  it('handles array values', () => {
    const result = buildFrontmatter({ tags: ['machine-learning', 'intro'] });
    expect(result).toContain('tags: ["machine-learning", "intro"]');
  });

  it('handles null values', () => {
    const result = buildFrontmatter({ previousId: null });
    expect(result).toContain('previousId: null');
  });

  it('skips undefined values', () => {
    const result = buildFrontmatter({ defined: 'yes', undefined: undefined });
    expect(result).toContain('defined: yes');
    expect(result).not.toContain('undefined');
  });

  it('wraps strings without special characters without quotes', () => {
    const result = buildFrontmatter({ title: 'Simple Title' });
    expect(result).toContain('title: Simple Title');
    expect(result).not.toContain('"Simple Title"');
  });

  it('starts and ends with --- delimiters', () => {
    const result = buildFrontmatter({ title: 'Test' });
    expect(result).toMatch(/^---$/m);
    expect(result).toMatch(/---$/m);
  });

  it('handles complex frontmatter with multiple field types', () => {
    const result = buildFrontmatter({
      title: 'Linear Regression',
      difficulty: 'intermediate',
      condensed: false,
      order: 1,
      sourceRefs: ['intro-to-ml.md'],
      generatedAt: '2024-01-15T10:30:00Z',
      generation_mode: 'grounded',
    });
    expect(result).toContain('title: Linear Regression');
    expect(result).toContain('difficulty: intermediate');
    expect(result).toContain('condensed: false');
    expect(result).toContain('order: 1');
    expect(result).toContain('sourceRefs: ["intro-to-ml.md"]');
    expect(result).toContain('generatedAt: "2024-01-15T10:30:00Z"');
    expect(result).toContain('generation_mode: grounded');
  });

  it('handles strings containing only numbers as unquoted', () => {
    const result = buildFrontmatter({ lessonId: 'lesson-42' });
    expect(result).toContain('lessonId: lesson-42');
  });

  it('handles courseId with hyphens as unquoted', () => {
    const result = buildFrontmatter({ courseId: 'ml-basics-123' });
    expect(result).toContain('courseId: ml-basics-123');
  });
});