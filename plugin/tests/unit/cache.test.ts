import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from '../../src/services/cache';
import type { CourseMeta, CourseId, StageCache } from '../../src/interfaces';

describe('CacheService', () => {
  const mockAdapter = {
    write: vi.fn(),
    rename: vi.fn(),
    read: vi.fn(),
    mkdir: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
  };

  const pluginDir = '/plugin';
  let cache: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheService(mockAdapter as any, pluginDir);
  });

  describe('writeStage', () => {
    it('writes atomically via tmp then rename', async () => {
      const courseId = 'test-course-123' as CourseId;
      const meta: CourseMeta = {
        courseId,
        seedTopic: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
        lastStageCompleted: null,
        modelUsed: 'test-model',
      };
      const currentCache: StageCache = { meta };

      mockAdapter.write.mockResolvedValue(undefined);
      mockAdapter.rename.mockResolvedValue(undefined);

      await cache.writeStage(courseId, 0, { courseId, root: { id: 'r', title: 'R', children: [] }, selectedIds: [] }, currentCache);

      expect(mockAdapter.write).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String)
      );
      expect(mockAdapter.rename).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('stage0.json')
      );
    });
  });

  describe('writeMeta', () => {
    it('writes meta atomically', async () => {
      const courseId = 'test-course-123' as CourseId;
      const meta: CourseMeta = {
        courseId,
        seedTopic: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
        lastStageCompleted: null,
        modelUsed: 'test-model',
      };

      mockAdapter.write.mockResolvedValue(undefined);
      mockAdapter.rename.mockResolvedValue(undefined);
      mockAdapter.mkdir.mockResolvedValue(undefined);

      await cache.writeMeta(courseId, meta);

      expect(mockAdapter.mkdir).toHaveBeenCalled();
      expect(mockAdapter.write).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String)
      );
    });
  });

  describe('getCourseIds', () => {
    it('returns empty array when no courses exist', async () => {
      mockAdapter.list.mockResolvedValue({ files: [], folders: [] });

      const ids = await cache.getCourseIds();
      expect(ids).toEqual([]);
    });
  });

  describe('clearCourse', () => {
    it('removes course directory', async () => {
      mockAdapter.list.mockResolvedValue({ files: [], folders: [] });
      mockAdapter.remove.mockResolvedValue(undefined);

      await cache.clearCourse('test-course' as CourseId);

      expect(mockAdapter.remove).toHaveBeenCalled();
    });
  });
});