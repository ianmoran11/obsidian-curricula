import type {
  CourseId,
  CourseMeta,
  ScopedTaxonomy,
  TaxonomyNode,
  Concept,
  ConceptList,
  LikertScore,
  ProficiencyMap,
  LessonSpec,
  ModuleSpec,
  Curriculum,
  GenerationProgress,
  GeneratedLesson,
  StageCache,
} from '../../src/interfaces';

export type GenerationMode = 'grounded' | 'augmented' | 'knowledge-only';

export const KNOWLEDGE_ONLY_PLACEHOLDER = '(no user-provided sources — rely on your general knowledge of the topic)';

export function makeCourseId(seed: string = 'test'): CourseId {
  return `${seed}-${Date.now()}`;
}

export function makeCourseMeta(overrides: Partial<CourseMeta> = {}): CourseMeta {
  return {
    courseId: makeCourseId(),
    seedTopic: 'Machine Learning',
    createdAt: '2024-01-15T10:30:00Z',
    lastStageCompleted: null,
    modelUsed: 'anthropic/claude-3.5-haiku',
    ...overrides,
  };
}

export function makeTaxonomyNode(overrides: Partial<TaxonomyNode> & { children?: TaxonomyNode[] } = {}): TaxonomyNode {
  return {
    id: 'ml',
    title: 'Machine Learning',
    description: 'Introduction to ML',
    children: [],
    ...overrides,
  };
}

export function makeScopedTaxonomy(overrides: Partial<ScopedTaxonomy> = {}): ScopedTaxonomy {
  return {
    courseId: makeCourseId(),
    root: makeTaxonomyNode({ id: 'ml', title: 'Machine Learning', children: [
      makeTaxonomyNode({ id: 'ml.supervised', title: 'Supervised Learning', children: [
        makeTaxonomyNode({ id: 'ml.supervised.classification', title: 'Classification', children: [] }),
        makeTaxonomyNode({ id: 'ml.supervised.regression', title: 'Regression', children: [] }),
      ]}),
      makeTaxonomyNode({ id: 'ml.unsupervised', title: 'Unsupervised Learning', children: [
        makeTaxonomyNode({ id: 'ml.unsupervised.clustering', title: 'Clustering', children: [] }),
      ]}),
    ]}),
    selectedIds: ['ml.supervised.classification', 'ml.supervised.regression'],
    ...overrides,
  };
}

export function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: 'supervised-learning',
    name: 'Supervised Learning',
    definition: 'Learning from labeled training data to predict outputs for new inputs.',
    sourceRefs: [],
    ...overrides,
  };
}

export function makeConceptList(overrides: Partial<ConceptList> & { concepts?: Concept[] } = {}): ConceptList {
  return {
    courseId: makeCourseId(),
    concepts: [
      makeConcept({ id: 'supervised-learning', name: 'Supervised Learning', definition: 'Learning from labeled data.', sourceRefs: [] }),
      makeConcept({ id: 'unsupervised-learning', name: 'Unsupervised Learning', definition: 'Finding structure in unlabeled data.', sourceRefs: [] }),
      makeConcept({ id: 'reinforcement-learning', name: 'Reinforcement Learning', definition: 'Learning through interaction with an environment.', sourceRefs: [] }),
      makeConcept({ id: 'classification', name: 'Classification', definition: 'Predicting categorical outcomes from input features.', sourceRefs: [] }),
      makeConcept({ id: 'regression', name: 'Regression', definition: 'Predicting continuous numeric values from input features.', sourceRefs: [] }),
    ],
    ...overrides,
  };
}

export function makeProficiencyMap(overrides: Partial<ProficiencyMap> = {}): ProficiencyMap {
  return {
    courseId: makeCourseId(),
    scores: {
      'supervised-learning': 3,
      'unsupervised-learning': 2,
      'reinforcement-learning': 1,
      'classification': 3,
      'regression': 4,
    },
    ...overrides,
  };
}

export function makeLessonSpec(overrides: Partial<LessonSpec> = {}): LessonSpec {
  return {
    id: 'lesson-1',
    title: 'What is Machine Learning?',
    summary: 'An introduction to machine learning concepts and paradigms.',
    prerequisiteLessonIds: [],
    relatedConceptIds: ['supervised-learning'],
    difficulty: 'intro',
    condensed: false,
    ...overrides,
  };
}

export function makeModuleSpec(overrides: Partial<ModuleSpec> & { lessons?: LessonSpec[] } = {}): ModuleSpec {
  return {
    id: 'module-1',
    title: 'Introduction',
    lessons: [
      makeLessonSpec({ id: 'lesson-1', title: 'What is Machine Learning?', prerequisiteLessonIds: [], relatedConceptIds: ['supervised-learning'] }),
      makeLessonSpec({ id: 'lesson-2', title: 'Types of ML', prerequisiteLessonIds: ['lesson-1'], relatedConceptIds: ['supervised-learning', 'unsupervised-learning', 'reinforcement-learning'] }),
    ],
    ...overrides,
  };
}

export function makeCurriculum(overrides: Partial<Curriculum> & { modules?: ModuleSpec[] } = {}): Curriculum {
  return {
    courseId: makeCourseId(),
    title: 'Machine Learning Fundamentals',
    modules: [
      makeModuleSpec({ id: 'module-1', title: 'Introduction', lessons: [
        makeLessonSpec({ id: 'lesson-1', title: 'What is Machine Learning?', summary: 'An introduction.', prerequisiteLessonIds: [], relatedConceptIds: ['supervised-learning'] }),
        makeLessonSpec({ id: 'lesson-2', title: 'Types of ML', summary: 'Overview of ML types.', prerequisiteLessonIds: ['lesson-1'], relatedConceptIds: ['supervised-learning', 'unsupervised-learning'] }),
      ]}),
      makeModuleSpec({ id: 'module-2', title: 'Supervised Learning', lessons: [
        makeLessonSpec({ id: 'lesson-3', title: 'Classification', summary: 'Classifying data.', prerequisiteLessonIds: ['lesson-2'], relatedConceptIds: ['classification'] }),
        makeLessonSpec({ id: 'lesson-4', title: 'Regression', summary: 'Predicting values.', prerequisiteLessonIds: ['lesson-3'], relatedConceptIds: ['regression'], condensed: true }),
      ]}),
    ],
    ...overrides,
  };
}

export function makeGeneratedLesson(overrides: Partial<GeneratedLesson> = {}): GeneratedLesson {
  return {
    lessonId: 'lesson-1',
    filePath: '4-Curriculum/Introduction/lesson-1.md',
    status: 'pending',
    sourceRefs: [],
    ...overrides,
  };
}

export function makeGenerationProgress(overrides: Partial<GenerationProgress> & { lessons?: GeneratedLesson[] } = {}): GenerationProgress {
  return {
    courseId: makeCourseId(),
    lessons: [
      makeGeneratedLesson({ lessonId: 'lesson-1', filePath: '4-Curriculum/Introduction/lesson-1.md', status: 'pending' }),
      makeGeneratedLesson({ lessonId: 'lesson-2', filePath: '4-Curriculum/Introduction/lesson-2.md', status: 'pending' }),
    ],
    startedAt: '2024-01-15T10:30:00Z',
    ...overrides,
  };
}

export function makeStageCache(overrides: Partial<StageCache> = {}): StageCache {
  return {
    meta: makeCourseMeta(),
    ...overrides,
  };
}

export interface GroundedModeFixtures {
  mode: 'grounded';
  contextText: string;
  files: string[];
  conceptList: ConceptList;
}

export interface AugmentedModeFixtures {
  mode: 'augmented';
  contextText: string;
  files: string[];
  conceptList: ConceptList;
}

export interface KnowledgeOnlyModeFixtures {
  mode: 'knowledge-only';
  contextText: typeof KNOWLEDGE_ONLY_PLACEHOLDER;
  files: string[];
  conceptList: ConceptList;
}

export type ModeFixtures = GroundedModeFixtures | AugmentedModeFixtures | KnowledgeOnlyModeFixtures;

export function buildGroundedMode(conceptOverrides: Partial<Concept> = {}): GroundedModeFixtures {
  const files = ['intro-to-ml.md', 'linear-algebra-primer.md'];
  const concepts: Concept[] = [
    makeConcept({ id: 'supervised-learning', name: 'Supervised Learning', definition: 'Learning from labeled data.', sourceRefs: ['intro-to-ml.md'] }),
    makeConcept({ id: 'unsupervised-learning', name: 'Unsupervised Learning', definition: 'Finding structure in unlabeled data.', sourceRefs: ['intro-to-ml.md'] }),
    makeConcept({ id: 'classification', name: 'Classification', definition: 'Predicting categorical outcomes.', sourceRefs: ['intro-to-ml.md'] }),
    makeConcept({ id: 'vectors', name: 'Vectors', definition: 'Ordered lists of numbers representing points in space.', sourceRefs: ['linear-algebra-primer.md'] }),
    makeConcept({ id: 'matrices', name: 'Matrices', definition: 'Rectangular arrays of numbers.', sourceRefs: ['linear-algebra-primer.md'] }),
  ];

  return {
    mode: 'grounded',
    contextText: '===== intro-to-ml.md =====\n# Introduction to Machine Learning\n\nMachine learning content here...\n\n===== linear-algebra-primer.md =====\n# Linear Algebra\n\nVectors and matrices content...',
    files,
    conceptList: {
      courseId: makeCourseId(),
      concepts: concepts.map(c => ({ ...c, ...conceptOverrides })),
    },
  };
}

export function buildAugmentedMode(conceptOverrides: Partial<Concept> = {}): AugmentedModeFixtures {
  const files = ['intro-to-ml.md'];
  const concepts: Concept[] = [
    makeConcept({ id: 'supervised-learning', name: 'Supervised Learning', definition: 'Learning from labeled data.', sourceRefs: ['intro-to-ml.md'] }),
    makeConcept({ id: 'unsupervised-learning', name: 'Unsupervised Learning', definition: 'Finding structure in unlabeled data.', sourceRefs: [] }),
    makeConcept({ id: 'neural-networks', name: 'Neural Networks', definition: 'Computing systems inspired by biological neural networks.', sourceRefs: [] }),
  ];

  return {
    mode: 'augmented',
    contextText: '===== intro-to-ml.md =====\n# Introduction to Machine Learning\n\nMachine learning content...',
    files,
    conceptList: {
      courseId: makeCourseId(),
      concepts: concepts.map(c => ({ ...c, ...conceptOverrides })),
    },
  };
}

export function buildKnowledgeOnlyMode(conceptOverrides: Partial<Concept> = {}): KnowledgeOnlyModeFixtures {
  const concepts: Concept[] = [
    makeConcept({ id: 'supervised-learning', name: 'Supervised Learning', definition: 'Learning from labeled data.', sourceRefs: [] }),
    makeConcept({ id: 'unsupervised-learning', name: 'Unsupervised Learning', definition: 'Finding structure in unlabeled data.', sourceRefs: [] }),
    makeConcept({ id: 'reinforcement-learning', name: 'Reinforcement Learning', definition: 'Learning through interaction with an environment.', sourceRefs: [] }),
    makeConcept({ id: 'classification', name: 'Classification', definition: 'Predicting categorical outcomes.', sourceRefs: [] }),
    makeConcept({ id: 'regression', name: 'Regression', definition: 'Predicting continuous values.', sourceRefs: [] }),
  ];

  return {
    mode: 'knowledge-only',
    contextText: KNOWLEDGE_ONLY_PLACEHOLDER,
    files: [],
    conceptList: {
      courseId: makeCourseId(),
      concepts: concepts.map(c => ({ ...c, ...conceptOverrides })),
    },
  };
}

export function buildAllModes(): {
  grounded: GroundedModeFixtures;
  augmented: AugmentedModeFixtures;
  knowledgeOnly: KnowledgeOnlyModeFixtures;
} {
  return {
    grounded: buildGroundedMode(),
    augmented: buildAugmentedMode(),
    knowledgeOnly: buildKnowledgeOnlyMode(),
  };
}

export function classifyRunMode(contextText: string, conceptList: ConceptList): GenerationMode {
  if (contextText === KNOWLEDGE_ONLY_PLACEHOLDER) {
    return 'knowledge-only';
  }

  const hasAnySourceRefs = conceptList.concepts.some(c => c.sourceRefs.length > 0);
  if (hasAnySourceRefs) {
    const allHaveSourceRefs = conceptList.concepts.every(c => c.sourceRefs.length > 0);
    return allHaveSourceRefs ? 'grounded' : 'augmented';
  }

  return 'knowledge-only';
}

export function isKnowledgeOnlyContext(contextText: string): boolean {
  return contextText === KNOWLEDGE_ONLY_PLACEHOLDER;
}

export function hasGroundedConcepts(conceptList: ConceptList): boolean {
  return conceptList.concepts.some(c => c.sourceRefs.length > 0);
}

export function allConceptsGrounded(conceptList: ConceptList): boolean {
  return conceptList.concepts.every(c => c.sourceRefs.length > 0);
}

export function someConceptsAugmented(conceptList: ConceptList): boolean {
  const grounded = conceptList.concepts.filter(c => c.sourceRefs.length > 0).length;
  const total = conceptList.concepts.length;
  return grounded > 0 && grounded < total;
}
