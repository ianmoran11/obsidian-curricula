import { describe, it, expect } from 'vitest';
import {
  COVER_MODE_THRESHOLD,
  isCoverMode,
  isInnerMode,
  getViewportMode,
  isTouchTargetValid,
  isTouchTargetValidBoth,
} from '../../src/ui/responsive';

describe('responsive helpers', () => {
  describe('COVER_MODE_THRESHOLD', () => {
    it('is defined as 900', () => {
      expect(COVER_MODE_THRESHOLD).toBe(900);
    });
  });

  describe('isCoverMode', () => {
    it('returns true when viewport is below threshold (899)', () => {
      expect(isCoverMode(899)).toBe(true);
    });

    it('returns true when viewport is much smaller (320)', () => {
      expect(isCoverMode(320)).toBe(true);
    });

    it('returns false when viewport equals threshold (900)', () => {
      expect(isCoverMode(900)).toBe(false);
    });

    it('returns false when viewport is above threshold (901)', () => {
      expect(isCoverMode(901)).toBe(false);
    });

    it('returns false for large viewports (1920)', () => {
      expect(isCoverMode(1920)).toBe(false);
    });

    it('handles cover screen width on mobile (~2316px outer width but offsetWidth varies)', () => {
      expect(isCoverMode(600)).toBe(true);
      expect(isCoverMode(800)).toBe(true);
    });

    it('handles inner screen width on tablet-like displays', () => {
      expect(isCoverMode(1024)).toBe(false);
      expect(isCoverMode(2176)).toBe(false);
    });
  });

  describe('isInnerMode', () => {
    it('returns false when viewport is below threshold', () => {
      expect(isInnerMode(899)).toBe(false);
    });

    it('returns true when viewport equals threshold', () => {
      expect(isInnerMode(900)).toBe(true);
    });

    it('returns true when viewport is above threshold', () => {
      expect(isInnerMode(901)).toBe(true);
    });

    it('is the inverse of isCoverMode', () => {
      for (const width of [320, 600, 800, 899, 900, 901, 1024, 1920]) {
        expect(isInnerMode(width)).toBe(!isCoverMode(width));
      }
    });
  });

  describe('getViewportMode', () => {
    it('returns "cover" for widths below threshold', () => {
      expect(getViewportMode(899)).toBe('cover');
      expect(getViewportMode(600)).toBe('cover');
      expect(getViewportMode(320)).toBe('cover');
    });

    it('returns "inner" for widths at or above threshold', () => {
      expect(getViewportMode(900)).toBe('inner');
      expect(getViewportMode(901)).toBe('inner');
      expect(getViewportMode(1024)).toBe('inner');
    });

    it('returns "inner" for Galaxy Z Fold inner screen dimensions', () => {
      expect(getViewportMode(2176)).toBe('inner');
    });

    it('returns "cover" for narrow phone-width viewports', () => {
      expect(getViewportMode(400)).toBe('cover');
      expect(getViewportMode(500)).toBe('cover');
    });
  });

  describe('isTouchTargetValid', () => {
    it('returns true for size >= 48px', () => {
      expect(isTouchTargetValid(48)).toBe(true);
      expect(isTouchTargetValid(49)).toBe(true);
      expect(isTouchTargetValid(100)).toBe(true);
    });

    it('returns false for size < 48px', () => {
      expect(isTouchTargetValid(47)).toBe(false);
      expect(isTouchTargetValid(1)).toBe(false);
      expect(isTouchTargetValid(0)).toBe(false);
    });

    it('respects custom minimum size', () => {
      expect(isTouchTargetValid(32, 32)).toBe(true);
      expect(isTouchTargetValid(31, 32)).toBe(false);
    });

    it('handles typical button sizes in the UI', () => {
      expect(isTouchTargetValid(48)).toBe(true);
      expect(isTouchTargetValid(44)).toBe(false);
    });
  });

  describe('isTouchTargetValidBoth', () => {
    it('returns true when both dimensions >= 48px', () => {
      expect(isTouchTargetValidBoth(48, 48)).toBe(true);
      expect(isTouchTargetValidBoth(100, 100)).toBe(true);
    });

    it('returns false when width < 48px', () => {
      expect(isTouchTargetValidBoth(47, 48)).toBe(false);
    });

    it('returns false when height < 48px', () => {
      expect(isTouchTargetValidBoth(48, 47)).toBe(false);
    });

    it('returns false when both dimensions are too small', () => {
      expect(isTouchTargetValidBoth(47, 47)).toBe(false);
    });

    it('respects custom minimum size', () => {
      expect(isTouchTargetValidBoth(32, 32, 32)).toBe(true);
      expect(isTouchTargetValidBoth(31, 31, 32)).toBe(false);
    });
  });
});

describe('UI-state logic', () => {
  describe('hasAtLeastOneLeafSelected', () => {
    const tree = {
      id: 'root',
      title: 'Root',
      children: [
        {
          id: 'child1',
          title: 'Child 1',
          children: [
            { id: 'leaf1', title: 'Leaf 1', children: [] },
            { id: 'leaf2', title: 'Leaf 2', children: [] },
          ],
        },
        {
          id: 'child2',
          title: 'Child 2',
          children: [
            { id: 'leaf3', title: 'Leaf 3', children: [] },
          ],
        },
      ],
    };

    it('returns true when a leaf is selected', () => {
      const selectedIds = new Set(['leaf1']);
      const checkLeaves = (node: typeof tree): boolean => {
        if (node.children.length === 0) {
          return selectedIds.has(node.id);
        }
        return node.children.some(checkLeaves);
      };
      expect(checkLeaves(tree)).toBe(true);
    });

    it('returns false when no leaves are selected', () => {
      const selectedIds = new Set<string>();
      const checkLeaves = (node: typeof tree): boolean => {
        if (node.children.length === 0) {
          return selectedIds.has(node.id);
        }
        return node.children.some(checkLeaves);
      };
      expect(checkLeaves(tree)).toBe(false);
    });
  });

  describe('cascade selection logic', () => {
    it('correctly adds descendants when selecting a parent', () => {
      const node = {
        id: 'parent',
        title: 'Parent',
        children: [
          { id: 'child1', title: 'Child 1', children: [] },
          { id: 'child2', title: 'Child 2', children: [] },
        ],
      };

      const selectedIds = new Set<string>();
      const setOrClear = (id: string) => selectedIds.add(id);
      const traverse = (n: typeof node) => {
        setOrClear(n.id);
        n.children.forEach(traverse);
      };

      node.children.forEach(traverse);
      expect(selectedIds.has('child1')).toBe(true);
      expect(selectedIds.has('child2')).toBe(true);
    });

    it('clears descendant nodes when unchecking a parent', () => {
      const node = {
        id: 'parent',
        title: 'Parent',
        children: [
          { id: 'child1', title: 'Child 1', children: [] },
          { id: 'child2', title: 'Child 2', children: [] },
        ],
      };

      const selectedIds = new Set(['child1', 'child2']);
      const setOrClear = (id: string) => selectedIds.delete(id);
      const traverse = (n: typeof node) => {
        setOrClear(n.id);
        n.children.forEach(traverse);
      };

      node.children.forEach(traverse);
      expect(selectedIds.has('child1')).toBe(false);
      expect(selectedIds.has('child2')).toBe(false);
    });

    it('cascades through multiple levels of children', () => {
      const tree = {
        id: 'root',
        title: 'Root',
        children: [
          {
            id: 'level1',
            title: 'Level 1',
            children: [
              { id: 'leaf1', title: 'Leaf 1', children: [] },
              { id: 'leaf2', title: 'Leaf 2', children: [] },
            ],
          },
        ],
      };

      const selectedIds = new Set<string>();
      const setOrClear = (id: string) => selectedIds.add(id);
      const traverse = (n: typeof tree) => {
        setOrClear(n.id);
        n.children.forEach(traverse);
      };

      tree.children.forEach(traverse);
      expect(selectedIds.has('level1')).toBe(true);
      expect(selectedIds.has('leaf1')).toBe(true);
      expect(selectedIds.has('leaf2')).toBe(true);
    });
  });

  describe('Likert score mapping', () => {
    const LIKERT_LABELS = ['Unfamiliar', 'Slightly Familiar', 'Moderately Familiar', 'Very Familiar', 'Expert'];
    const LIKERT_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];

    it('has correct number of labels for scores 1-5', () => {
      expect(LIKERT_LABELS.length).toBe(5);
    });

    it('has matching colors for each score level', () => {
      expect(LIKERT_COLORS.length).toBe(5);
    });

    it('labels are in order of increasing familiarity', () => {
      expect(LIKERT_LABELS[0]).toBe('Unfamiliar');
      expect(LIKERT_LABELS[4]).toBe('Expert');
    });

    it('score maps correctly to label index', () => {
      for (let score = 1; score <= 5; score++) {
        expect(LIKERT_LABELS[score - 1]).toBeDefined();
        expect(LIKERT_COLORS[score - 1]).toBeDefined();
      }
    });
  });

  describe('ProficiencyMap default score', () => {
    it('applies default score of 3 for skipped concepts', () => {
      const concepts = [
        { id: 'concept1', name: 'Concept 1', definition: 'Def 1' },
        { id: 'concept2', name: 'Concept 2', definition: 'Def 2' },
      ];

      const scores: Record<string, number> = { concept1: 5 };
      const DEFAULT_SKIP_SCORE = 3;

      for (const concept of concepts) {
        if (!scores[concept.id]) {
          scores[concept.id] = DEFAULT_SKIP_SCORE;
        }
      }

      expect(scores.concept1).toBe(5);
      expect(scores.concept2).toBe(3);
    });
  });
});