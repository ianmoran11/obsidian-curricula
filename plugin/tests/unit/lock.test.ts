import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockService, LockInfo } from '../../src/services/lock';
import type { CourseId } from '../../src/interfaces';

describe('LockService', () => {
  const mockAdapter = {
    write: vi.fn(),
    rename: vi.fn(),
    read: vi.fn(),
    remove: vi.fn(),
  };

  const mockVault = {
    getRoot: () => ({ path: '/vault' }),
  };

  let lock: LockService;

  beforeEach(() => {
    vi.clearAllMocks();
    lock = new LockService(mockVault as any, mockAdapter as any);
  });

  describe('acquireLock', () => {
    it('acquires lock when none exists', async () => {
      mockAdapter.read.mockRejectedValue(new Error('no lock'));
      mockAdapter.write.mockResolvedValue(undefined);
      mockAdapter.rename.mockResolvedValue(undefined);

      const result = await lock.acquireLock('course-123' as CourseId, 'device-A');

      expect(result).toBe(true);
      expect(mockAdapter.write).toHaveBeenCalled();
    });

    it('acquires lock when existing lock is stale', async () => {
      const staleLock: LockInfo = {
        courseId: 'old-course' as CourseId,
        deviceName: 'device-B',
        startedAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
      };
      mockAdapter.read.mockResolvedValue(JSON.stringify(staleLock));
      mockAdapter.write.mockResolvedValue(undefined);
      mockAdapter.rename.mockResolvedValue(undefined);

      const result = await lock.acquireLock('course-123' as CourseId, 'device-A');

      expect(result).toBe(true);
    });
  });

  describe('getLockInfo', () => {
    it('returns null when no lock exists', async () => {
      mockAdapter.read.mockRejectedValue(new Error('not found'));

      const info = await lock.getLockInfo();
      expect(info).toBeNull();
    });

    it('returns lock info when lock exists', async () => {
      const lockInfo: LockInfo = {
        courseId: 'course-123' as CourseId,
        deviceName: 'device-A',
        startedAt: Date.now(),
      };
      mockAdapter.read.mockResolvedValue(JSON.stringify(lockInfo));

      const info = await lock.getLockInfo();
      expect(info?.courseId).toBe('course-123');
    });

    it('clears stale locks', async () => {
      const staleLock: LockInfo = {
        courseId: 'course-123' as CourseId,
        deviceName: 'device-A',
        startedAt: Date.now() - 60 * 60 * 1000,
      };
      mockAdapter.read.mockResolvedValue(JSON.stringify(staleLock));
      mockAdapter.remove.mockResolvedValue(undefined);

      const info = await lock.getLockInfo();
      expect(info).toBeNull();
      expect(mockAdapter.remove).toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('removes lock file', async () => {
      mockAdapter.remove.mockResolvedValue(undefined);

      await lock.releaseLock();

      expect(mockAdapter.remove).toHaveBeenCalled();
    });
  });

  describe('clearStaleLocks', () => {
    it('clears locks older than 30 minutes', async () => {
      const staleLock: LockInfo = {
        courseId: 'course-123' as CourseId,
        deviceName: 'device-A',
        startedAt: Date.now() - 35 * 60 * 1000,
      };
      mockAdapter.read.mockResolvedValue(JSON.stringify(staleLock));
      mockAdapter.remove.mockResolvedValue(undefined);

      await lock.clearStaleLocks();

      expect(mockAdapter.remove).toHaveBeenCalled();
    });
  });
});