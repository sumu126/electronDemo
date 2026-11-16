import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyLockFailure,
  describeLockFailure,
  clearStaleWindowsLockFile,
} from './singleton-lock';

const isWindows = process.platform === 'win32';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'singleton-lock-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('clearStaleWindowsLockFile', () => {
  it('非 Windows 直接跳过，不碰 Electron 的 POSIX 锁', () => {
    if (!isWindows) {
      expect(clearStaleWindowsLockFile(tempDir)).toBe('skipped');
    }
  });

  it('lockfile 不存在时返回 missing', () => {
    if (!isWindows) {
      return;
    }

    expect(clearStaleWindowsLockFile(tempDir)).toBe('missing');
  });

  it('普通残留 lockfile 会被删除', () => {
    if (!isWindows) {
      return;
    }

    const lockPath = join(tempDir, 'lockfile');
    writeFileSync(lockPath, 'stale', 'utf-8');

    expect(clearStaleWindowsLockFile(tempDir)).toBe('removed');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('只读 lockfile 清掉只读位后会被删除', () => {
    if (!isWindows) {
      return;
    }

    const lockPath = join(tempDir, 'lockfile');
    writeFileSync(lockPath, 'stale', 'utf-8');
    chmodSync(lockPath, 0o444);

    expect(clearStaleWindowsLockFile(tempDir)).toBe('removed');
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe('classifyLockFailure', () => {
  it('EBUSY 是活实例持有，EPERM 是权限/安全软件，ENOENT 是文件已不存在', () => {
    expect(classifyLockFailure('EBUSY')).toBe('held');
    expect(classifyLockFailure('EPERM')).toBe('unavailable');
    expect(classifyLockFailure('EACCES')).toBe('unavailable');
    expect(classifyLockFailure('ENOENT')).toBe('missing');
    expect(classifyLockFailure(undefined)).toBe('unavailable');
  });
});

describe('describeLockFailure', () => {
  it('不同 probe 给出不同、可操作的错误原因', () => {
    expect(describeLockFailure('held')).toContain('another instance');
    expect(describeLockFailure('unavailable')).toContain('permissions');
    expect(describeLockFailure('removed')).toContain('stale lockfile');
    expect(describeLockFailure('missing')).toContain('could not be created');
    expect(describeLockFailure('skipped')).toContain('POSIX lock');
  });
});
