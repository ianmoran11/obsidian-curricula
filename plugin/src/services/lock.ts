import { Vault, DataAdapter } from 'obsidian';
import type { CourseId } from '../interfaces';

export interface LockInfo {
  courseId: CourseId;
  deviceName: string;
  startedAt: number;
}

const LOCK_FILE = '.auto-tutor.lock';
const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class LockService {
  private vault: Vault;
  private adapter: DataAdapter;

  constructor(vault: Vault, adapter: DataAdapter) {
    this.vault = vault;
    this.adapter = adapter;
  }

  private getLockPath(): string {
    return `${this.vault.getRoot().path}/${LOCK_FILE}`;
  }

  async acquireLock(courseId: CourseId, deviceName: string): Promise<boolean> {
    const lockPath = this.getLockPath();

    try {
      const existing = await this.getLockInfo();
      if (existing) {
        const age = Date.now() - existing.startedAt;
        if (age < LOCK_TIMEOUT_MS && existing.courseId !== courseId) {
          return false;
        }
      }

      const lockInfo: LockInfo = {
        courseId,
        deviceName,
        startedAt: Date.now(),
      };

      const tmpPath = lockPath + '.tmp';
      await this.adapter.write(tmpPath, JSON.stringify(lockInfo));
      await this.adapter.rename(tmpPath, lockPath);
      return true;
    } catch {
      return false;
    }
  }

  async getLockInfo(): Promise<LockInfo | null> {
    const lockPath = this.getLockPath();

    try {
      const content = await this.adapter.read(lockPath);
      const info = JSON.parse(content) as LockInfo;

      if (Date.now() - info.startedAt >= LOCK_TIMEOUT_MS) {
        await this.releaseLock();
        return null;
      }

      return info;
    } catch {
      return null;
    }
  }

  async releaseLock(): Promise<void> {
    const lockPath = this.getLockPath();
    try {
      await this.adapter.remove(lockPath);
    } catch {
      // Ignore
    }
  }

  async isLockedByAnother(courseId: CourseId): Promise<{ locked: boolean; info?: LockInfo }> {
    const info = await this.getLockInfo();

    if (!info) {
      return { locked: false };
    }

    if (info.courseId !== courseId) {
      return { locked: true, info };
    }

    return { locked: false };
  }

  async clearStaleLocks(): Promise<void> {
    const lockPath = this.getLockPath();

    try {
      const content = await this.adapter.read(lockPath);
      const info = JSON.parse(content) as LockInfo;

      if (Date.now() - info.startedAt >= LOCK_TIMEOUT_MS) {
        await this.adapter.remove(lockPath);
      }
    } catch {
      // No lock or can't read
    }
  }
}