import { z } from 'zod';
import type {
  CourseId, CourseMeta, TaxonomyNode, ScopedTaxonomy, Concept,
  ConceptList, LikertScore, ProficiencyMap, LessonSpec,
  ModuleSpec, Curriculum, GeneratedLesson, GenerationProgress, StageCache
} from '../interfaces';

const taxonomyNodeSchema: z.ZodType<TaxonomyNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    children: z.array(taxonomyNodeSchema),
  })
);

const courseMetaSchema: z.ZodType<CourseMeta> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  seedTopic: z.string(),
  createdAt: z.string(),
  lastStageCompleted: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null()]),
  modelUsed: z.string(),
});

const scopedTaxonomySchema: z.ZodType<ScopedTaxonomy> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  root: taxonomyNodeSchema,
  selectedIds: z.array(z.string()),
});

const conceptSchema: z.ZodType<Concept> = z.object({
  id: z.string(),
  name: z.string(),
  definition: z.string().max(200),
  sourceRefs: z.array(z.string()),
});

const conceptListSchema: z.ZodType<ConceptList> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  concepts: z.array(conceptSchema),
});

const likertScoreSchema: z.ZodType<LikertScore> = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const proficiencyMapSchema: z.ZodType<ProficiencyMap> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  scores: z.record(z.string(), likertScoreSchema),
});

const lessonSpecSchema: z.ZodType<LessonSpec> = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  prerequisiteLessonIds: z.array(z.string()),
  relatedConceptIds: z.array(z.string()),
  difficulty: z.union([z.literal('intro'), z.literal('intermediate'), z.literal('advanced')]),
  condensed: z.boolean(),
});

const moduleSpecSchema: z.ZodType<ModuleSpec> = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(lessonSpecSchema),
});

const curriculumSchema: z.ZodType<Curriculum> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  title: z.string(),
  modules: z.array(moduleSpecSchema),
});

const generatedLessonSchema: z.ZodType<GeneratedLesson> = z.object({
  lessonId: z.string(),
  filePath: z.string(),
  status: z.union([z.literal('pending'), z.literal('writing'), z.literal('written'), z.literal('error')]),
  error: z.string().optional(),
  sourceRefs: z.array(z.string()),
});

const generationProgressSchema: z.ZodType<GenerationProgress> = z.object({
  courseId: z.string() as z.ZodType<CourseId>,
  lessons: z.array(generatedLessonSchema),
  canvasPath: z.string().optional(),
  indexPath: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

const stageCacheSchema: z.ZodType<StageCache> = z.object({
  meta: courseMetaSchema,
  stage0: scopedTaxonomySchema.optional(),
  stage1: conceptListSchema.optional(),
  stage2: proficiencyMapSchema.optional(),
  stage3: curriculumSchema.optional(),
  stage4: generationProgressSchema.optional(),
});

export const validators = {
  courseMeta: courseMetaSchema,
  taxonomyNode: taxonomyNodeSchema,
  scopedTaxonomy: scopedTaxonomySchema,
  concept: conceptSchema,
  conceptList: conceptListSchema,
  likertScore: likertScoreSchema,
  proficiencyMap: proficiencyMapSchema,
  lessonSpec: lessonSpecSchema,
  moduleSpec: moduleSpecSchema,
  curriculum: curriculumSchema,
  generatedLesson: generatedLessonSchema,
  generationProgress: generationProgressSchema,
  stageCache: stageCacheSchema,
};

export type ValidationErrorDetail = { path: string; message: string };

export class ValidationError extends Error {
  constructor(
    message: string,
    public details: ValidationErrorDetail[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details: ValidationErrorDetail[] = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}

export function validateCourseMeta(data: unknown): CourseMeta { return validate(courseMetaSchema, data); }
export function validateTaxonomyNode(data: unknown): TaxonomyNode { return validate(taxonomyNodeSchema, data); }
export function validateScopedTaxonomy(data: unknown): ScopedTaxonomy { return validate(scopedTaxonomySchema, data); }
export function validateConcept(data: unknown): Concept { return validate(conceptSchema, data); }
export function validateConceptList(data: unknown): ConceptList { return validate(conceptListSchema, data); }
export function validateProficiencyMap(data: unknown): ProficiencyMap { return validate(proficiencyMapSchema, data); }
export function validateCurriculum(data: unknown): Curriculum { return validate(curriculumSchema, data); }
export function validateStageCache(data: unknown): StageCache { return validate(stageCacheSchema, data); }