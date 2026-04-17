import { TaxonomyNode } from '../interfaces';
import { isCoverMode } from './responsive';

export interface TaxonomyViewOptions {
  container: HTMLElement;
  nodes: TaxonomyNode;
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: string[]) => void;
  onContinue: () => void;
}

export class TaxonomyView {
  private container: HTMLElement;
  private nodes: TaxonomyNode;
  private selectedIds: Set<string>;
  private onSelectionChange: (selectedIds: string[]) => void;
  private onContinue: () => void;

  constructor(options: TaxonomyViewOptions) {
    this.container = options.container;
    this.nodes = options.nodes;
    this.selectedIds = options.selectedIds;
    this.onSelectionChange = options.onSelectionChange;
    this.onContinue = options.onContinue;
    this.render();
  }

  private render(): void {
    this.container.empty();

    const coverMode = isCoverMode(document.body.offsetWidth);

    this.container.createEl('h2', { text: 'Select Topics to Include' });
    this.container.createEl('p', {
      text: coverMode
        ? 'Tap topics to include them. Use breadcrumbs to navigate.'
        : 'Check the topics you want in your curriculum. Nested topics are indented.',
    });

    const treeContainer = this.container.createDiv('taxonomy-tree');
    treeContainer.style.maxHeight = '400px';
    treeContainer.style.overflowY = 'auto';
    treeContainer.style.border = '1px solid var(--border-color)';
    treeContainer.style.borderRadius = '4px';
    treeContainer.style.padding = '8px';

    this.renderNode(treeContainer, this.nodes, coverMode);

    const footer = this.container.createDiv('taxonomy-footer');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.marginTop = '16px';
    footer.style.paddingTop = '16px';
    footer.style.borderTop = '1px solid var(--border-color)';

    const countEl = footer.createSpan('selected-count');
    this.updateCount(countEl);

    const buttonContainer = footer.createDiv('button-container');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';

    const continueBtn = buttonContainer.createEl('button', { text: 'Continue' }) as HTMLButtonElement;
    continueBtn.style.background = 'var(--interactive-accent)';
    continueBtn.style.color = 'var(--text-on-accent)';
    continueBtn.style.border = 'none';
    continueBtn.style.padding = '12px 24px';
    continueBtn.style.borderRadius = '4px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.minHeight = '48px';
    continueBtn.style.minWidth = '120px';
    continueBtn.style.fontSize = '14px';
    continueBtn.style.fontWeight = 'bold';

    continueBtn.addEventListener('click', () => {
      if (this.selectedIds.size > 0) {
        this.onContinue();
      }
    });

    continueBtn.disabled = this.selectedIds.size === 0;
    continueBtn.style.opacity = this.selectedIds.size === 0 ? '0.5' : '1';

    const selectAllBtn = buttonContainer.createEl('button', { text: 'Select All' }) as HTMLButtonElement;
    selectAllBtn.style.background = 'transparent';
    selectAllBtn.style.border = '1px solid var(--border-color)';
    selectAllBtn.style.padding = '12px 24px';
    selectAllBtn.style.borderRadius = '4px';
    selectAllBtn.style.cursor = 'pointer';
    selectAllBtn.style.minHeight = '48px';
    selectAllBtn.style.minWidth = '100px';
    selectAllBtn.style.fontSize = '14px';
    selectAllBtn.addEventListener('click', () => this.selectAll());
  }

  private renderNode(container: HTMLElement, node: TaxonomyNode, isCoverModeEnabled: boolean, depth = 0): void {
    const nodeEl = container.createDiv('taxonomy-node');
    nodeEl.style.marginLeft = `${depth * 20}px`;
    nodeEl.style.padding = '4px 0';

    const rowEl = nodeEl.createDiv('node-row');
    rowEl.style.display = 'flex';
    rowEl.style.alignItems = 'center';
    rowEl.style.gap = '8px';
    rowEl.style.padding = '8px 4px';
    rowEl.style.minHeight = '48px';
    rowEl.style.cursor = 'pointer';

    if (node.children.length > 0 && !isCoverModeEnabled) {
      const toggleEl = rowEl.createEl('span', { text: '▶', cls: 'expand-toggle' });
      toggleEl.style.cursor = 'pointer';
      toggleEl.style.fontSize = '16px';
      toggleEl.style.width = '32px';
      toggleEl.style.height = '32px';
      toggleEl.style.display = 'inline-flex';
      toggleEl.style.alignItems = 'center';
      toggleEl.style.justifyContent = 'center';
      toggleEl.style.minWidth = '32px';
      toggleEl.style.minHeight = '32px';

      toggleEl.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const childContainer = nodeEl.querySelector('.children-container') as HTMLElement;
        if (childContainer) {
          const isExpanded = childContainer.style.display !== 'none';
          childContainer.style.display = isExpanded ? 'none' : 'block';
          toggleEl.textContent = isExpanded ? '▶' : '▼';
        }
      });
    }

    const checkbox = rowEl.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
    checkbox.checked = this.selectedIds.has(node.id);
    checkbox.style.width = '24px';
    checkbox.style.height = '24px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.minWidth = '24px';
    checkbox.style.minHeight = '24px';

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        this.selectedIds.add(node.id);
      } else {
        this.selectedIds.delete(node.id);
      }

      if (node.children.length > 0) {
        this.cascadeSelection(node, checkbox.checked);
      }

      this.onSelectionChange(Array.from(this.selectedIds));
      this.updateDisplay();
    });

    const labelEl = rowEl.createEl('label', { text: node.title });
    labelEl.style.cursor = 'pointer';
    labelEl.style.flex = '1';
    labelEl.style.minHeight = '48px';
    labelEl.style.display = 'flex';
    labelEl.style.alignItems = 'center';
    if (node.description) {
      labelEl.style.fontStyle = 'italic';
      labelEl.style.color = 'var(--text-muted)';
    }

    labelEl.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    if (node.description) {
      labelEl.setAttribute('title', node.description);
    }

    if (node.children.length > 0) {
      const childContainer = nodeEl.createDiv('children-container');
      childContainer.style.display = 'block';

      for (const child of node.children) {
        this.renderNode(childContainer, child, isCoverModeEnabled, depth + 1);
      }
    }
  }

  private cascadeSelection(node: TaxonomyNode, selected: boolean): void {
    const setOrClear = selected
      ? (id: string) => this.selectedIds.add(id)
      : (id: string) => this.selectedIds.delete(id);

    const traverse = (n: TaxonomyNode) => {
      setOrClear(n.id);
      n.children.forEach(traverse);
    };

    node.children.forEach(traverse);
  }

  private updateDisplay(): void {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      const htmlCb = cb as HTMLInputElement;
      const nodeId = this.getNodeIdForCheckbox(htmlCb);
      if (nodeId) {
        htmlCb.checked = this.selectedIds.has(nodeId);
      }
    });

    const countEl = this.container.querySelector('.selected-count') as HTMLElement;
    if (countEl) {
      this.updateCount(countEl);
    }

    const continueBtn = this.container.querySelector('button:last-of-type') as HTMLButtonElement;
    if (continueBtn) {
      continueBtn.disabled = this.selectedIds.size === 0;
      continueBtn.style.opacity = this.selectedIds.size === 0 ? '0.5' : '1';
    }
  }

  private getNodeIdForCheckbox(checkbox: HTMLInputElement): string | null {
    const row = checkbox.closest('.node-row');
    const label = row?.querySelector('label');
    const title = label?.textContent;
    if (!title) return null;

    const findNode = (node: TaxonomyNode, title: string): TaxonomyNode | null => {
      if (node.title === title) return node;
      for (const child of node.children) {
        const found = findNode(child, title);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(this.nodes, title);
    return node?.id || null;
  }

  private updateCount(el: HTMLElement): void {
    const leafCount = this.countLeafNodes(this.nodes);
    const selectedLeaves = this.countSelectedLeaves(this.nodes);
    el.textContent = `${selectedLeaves} / ${leafCount} topics selected`;
  }

  private countLeafNodes(node: TaxonomyNode): number {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + this.countLeafNodes(child), 0);
  }

  private countSelectedLeaves(node: TaxonomyNode): number {
    if (node.children.length === 0) {
      return this.selectedIds.has(node.id) ? 1 : 0;
    }
    return node.children.reduce((sum, child) => sum + this.countSelectedLeaves(child), 0);
  }

  private selectAll(): void {
    const selectAllNodes = (node: TaxonomyNode) => {
      this.selectedIds.add(node.id);
      node.children.forEach(selectAllNodes);
    };
    selectAllNodes(this.nodes);
    this.onSelectionChange(Array.from(this.selectedIds));
    this.updateDisplay();
  }
}

export function createTaxonomyView(options: TaxonomyViewOptions): TaxonomyView {
  return new TaxonomyView(options);
}

export function hasAtLeastOneLeafSelected(nodes: TaxonomyNode, selectedIds: Set<string>): boolean {
  const checkLeaves = (node: TaxonomyNode): boolean => {
    if (node.children.length === 0) {
      return selectedIds.has(node.id);
    }
    return node.children.some(checkLeaves);
  };
  return checkLeaves(nodes);
}