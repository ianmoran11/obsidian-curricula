import { App, Modal, Notice } from 'obsidian';
import { isCoverMode } from './responsive';
import type { Concept, LikertScore, ProficiencyMap, CourseId } from '../interfaces';

export interface LikertModalOptions {
  app: App;
  concepts: Concept[];
  courseId: CourseId;
  onComplete: (proficiency: ProficiencyMap) => void;
  onCancel: () => void;
}

const LIKERT_LABELS = ['Unfamiliar', 'Slightly Familiar', 'Moderately Familiar', 'Very Familiar', 'Expert'];
const LIKERT_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];

export class LikertModal extends Modal {
  private concepts: Concept[];
  private courseId: CourseId;
  private onComplete: (proficiency: ProficiencyMap) => void;
  private onCancel: () => void;

  private currentIndex = 0;
  private scores: Record<string, LikertScore> = {};
  private conceptEls: HTMLElement[] = [];
  private cardsContainer: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private coverMode = false;

  constructor(options: LikertModalOptions) {
    super(options.app);
    this.concepts = options.concepts;
    this.courseId = options.courseId;
    this.onComplete = options.onComplete;
    this.onCancel = options.onCancel;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.style.padding = '20px';
    contentEl.style.maxWidth = '100%';

    this.coverMode = isCoverMode(document.body.offsetWidth);

    contentEl.createEl('h2', { text: 'Assess Your Proficiency' });

    contentEl.createEl('p', {
      text: 'Rate your familiarity with each concept from 1 (Unfamiliar) to 5 (Expert). Tap "Skip" if unsure.',
    });

    this.progressEl = contentEl.createDiv('likert-progress');
    this.progressEl.style.marginBottom = '16px';
    this.updateProgress();

    this.cardsContainer = contentEl.createDiv('likert-cards');
    this.cardsContainer.style.display = 'flex';
    this.cardsContainer.style.overflowX = 'auto';
    this.cardsContainer.style.scrollSnapType = 'x mandatory';
    this.cardsContainer.style.gap = '16px';
    this.cardsContainer.style.padding = '8px 0';

    for (let i = 0; i < this.concepts.length; i++) {
      const card = this.createCard(this.concepts[i], i);
      this.conceptEls.push(card);
      this.cardsContainer.appendChild(card);
    }

    this.setupSwipeGestures();
    this.showCard(0);
  }

  private createCard(concept: Concept, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'likert-card';
    const cardWidth = this.coverMode ? 'min(100%, 320px)' : 'min(400px, 100%)';
    card.style.cssText = `
      width: ${cardWidth};
      min-width: 280px;
      max-width: 400px;
      flex: 0 0 ${this.coverMode ? '100%' : 'auto'};
      scroll-snap-align: center;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: ${this.coverMode ? '16px' : '20px'};
      background: var(--background-secondary);
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    const conceptTitle = card.createEl('h3', { text: concept.name });
    conceptTitle.style.margin = '0';
    conceptTitle.style.fontSize = '18px';

    const definition = card.createEl('p', { text: concept.definition });
    definition.style.margin = '0';
    definition.style.color = 'var(--text-muted)';
    definition.style.fontSize = '14px';

    const buttonsContainer = card.createDiv('likert-buttons');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.marginTop = 'auto';
    buttonsContainer.style.paddingTop = '16px';
    buttonsContainer.style.flexWrap = 'wrap';
    buttonsContainer.style.justifyContent = 'center';

    for (let score = 1; score <= 5; score++) {
      const btn = buttonsContainer.createEl('button', {
        text: `${score}`,
        title: LIKERT_LABELS[score - 1],
      });
      btn.style.cssText = `
        min-width: 48px;
        min-height: 48px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 2px solid ${LIKERT_COLORS[score - 1]};
        background: ${this.scores[concept.id] === score ? LIKERT_COLORS[score - 1] : 'transparent'};
        color: ${this.scores[concept.id] === score ? 'white' : LIKERT_COLORS[score - 1]};
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      btn.addEventListener('click', () => {
        this.selectScore(concept.id, score as LikertScore);
        this.goToNext();
      });
    }

    const skipBtn = buttonsContainer.createEl('button', { text: 'Skip' });
    skipBtn.style.cssText = `
      min-width: 48px;
      min-height: 48px;
      padding: 0 16px;
      border-radius: 24px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
    `;
    skipBtn.addEventListener('click', () => this.goToNext());

    return card;
  }

  private selectScore(conceptId: string, score: LikertScore): void {
    this.scores[conceptId] = score;

    const cardIndex = this.concepts.findIndex(c => c.id === conceptId);
    const card = this.conceptEls[cardIndex];
    if (!card) return;

    const buttons = card.querySelectorAll('.likert-buttons button');
    for (let i = 0; i < buttons.length - 1; i++) {
      const isSelected = (i + 1) === score;
      const btn = buttons[i] as HTMLButtonElement;
      btn.style.background = isSelected ? LIKERT_COLORS[i] : 'transparent';
      btn.style.color = isSelected ? 'white' : LIKERT_COLORS[i];
    }
  }

  private setupSwipeGestures(): void {
    if (!this.cardsContainer) return;

    let startX = 0;
    let scrollLeft = 0;

    this.cardsContainer.addEventListener('touchstart', (e: TouchEvent) => {
      startX = e.touches[0].pageX;
      scrollLeft = this.cardsContainer!.scrollLeft;
    });

    this.cardsContainer.addEventListener('touchmove', (e: TouchEvent) => {
      const x = e.touches[0].pageX;
      const walk = (startX - x) * 1.5;
      this.cardsContainer!.scrollLeft = scrollLeft + walk;
    });

    this.cardsContainer.addEventListener('touchend', (e: TouchEvent) => {
      const x = e.changedTouches[0].pageX;
      const diff = startX - x;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.goToNext();
        } else {
          this.goToPrevious();
        }
      }
    });
  }

  private goToNext(): void {
    if (this.currentIndex < this.concepts.length - 1) {
      this.showCard(this.currentIndex + 1);
    } else {
      this.finish();
    }
  }

  private goToPrevious(): void {
    if (this.currentIndex > 0) {
      this.showCard(this.currentIndex - 1);
    }
  }

  private showCard(index: number): void {
    this.currentIndex = index;
    const card = this.conceptEls[index];
    if (!card || !this.cardsContainer) return;

    card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    this.updateProgress();
  }

  private updateProgress(): void {
    if (!this.progressEl) return;
    this.progressEl.textContent = `Concept ${this.currentIndex + 1} of ${this.concepts.length}`;
  }

  private finish(): void {
    const proficiencyMap: ProficiencyMap = {
      courseId: this.courseId,
      scores: { ...this.scores },
    };

    for (const concept of this.concepts) {
      if (!proficiencyMap.scores[concept.id]) {
        proficiencyMap.scores[concept.id] = 3;
      }
    }

    new Notice(`Proficiency assessment complete`);
    this.onComplete(proficiencyMap);
    this.close();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}