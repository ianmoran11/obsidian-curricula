import { describe, it, expect } from 'vitest';
import { hasAtLeastOneLeafSelected } from '../../src/ui/taxonomy-view';
import type { TaxonomyNode } from '../../src/interfaces';

describe('TaxonomyView helpers', () => {
  describe('hasAtLeastOneLeafSelected', () => {
    const tree: TaxonomyNode = {
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
      expect(hasAtLeastOneLeafSelected(tree, new Set(['leaf1']))).toBe(true);
    });

    it('returns true when multiple leaves are selected', () => {
      expect(hasAtLeastOneLeafSelected(tree, new Set(['leaf1', 'leaf2']))).toBe(true);
    });

    it('returns false when no leaves are selected', () => {
      expect(hasAtLeastOneLeafSelected(tree, new Set())).toBe(false);
    });

    it('returns false when only internal nodes (with children) are selected', () => {
      // child1 and child2 both have children (they are internal nodes)
      expect(hasAtLeastOneLeafSelected(tree, new Set(['child1', 'child2']))).toBe(false);
    });

    it('handles single-node tree (leaf)', () => {
      const single: TaxonomyNode = { id: 'single', title: 'Single', children: [] };
      expect(hasAtLeastOneLeafSelected(single, new Set(['single']))).toBe(true);
      expect(hasAtLeastOneLeafSelected(single, new Set())).toBe(false);
    });

    it('returns true when leaf from deep subtree is selected', () => {
      expect(hasAtLeastOneLeafSelected(tree, new Set(['leaf3']))).toBe(true);
    });
  });
});