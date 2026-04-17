// plugin/src/interfaces.ts - verbatim from PRD.md §10

export type CourseId = string;

export interface CourseMeta {
  courseId: CourseId;
  seedTopic: string;
  createdAt: string;
  lastStageCompleted: 0 | 1 | 2 | 3 | 4 | null;
  modelUsed: string;
}

/** Stage 0 — Taxonomy */
export interface TaxonomyNode {
  id: string;
  title: string;
  description?: string;
  children: TaxonomyNode[];
}

export interface ScopedTaxonomy {
  courseId: CourseId;
  root: TaxonomyNode;
  selectedIds: string[];
}

/** Stage 1 — Concepts */
export interface Concept {
  id: string;
  name: string;
  definition: string;
  sourceRefs: string[];
}

export interface ConceptList {
  courseId: CourseId;
  concepts: Concept[];
}

/** Stage 2 — Proficiency */
export type LikertScore = 1 | 2 | 3 | 4 | 5;

export interface ProficiencyMap {
  courseId: CourseId;
  scores: Record<string, LikertScore>;
}

/** Stage 3 — Curriculum */
export interface LessonSpec {
  id: string;
  title: string;
  summary: string;
  prerequisiteLessonIds: string[];
  relatedConceptIds: string[];
  difficulty: 'intro' | 'intermediate' | 'advanced';
  condensed: boolean;
}

export interface ModuleSpec {
  id: string;
  title: string;
  lessons: LessonSpec[];
}

export interface Curriculum {
  courseId: CourseId;
  title: string;
  modules: ModuleSpec[];
}

/** Stage 4 — Output tracking */
export interface GeneratedLesson {
  lessonId: string;
  filePath: string;
  status: 'pending' | 'writing' | 'written' | 'error';
  error?: string;
  sourceRefs: string[];
}

export interface GenerationProgress {
  courseId: CourseId;
  lessons: GeneratedLesson[];
  canvasPath?: string;
  indexPath?: string;
  startedAt: string;
  completedAt?: string;
}

/** Cache shape on disk */
export interface StageCache {
  meta: CourseMeta;
  stage0?: ScopedTaxonomy;
  stage1?: ConceptList;
  stage2?: ProficiencyMap;
  stage3?: Curriculum;
  stage4?: GenerationProgress;
}