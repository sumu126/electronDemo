import { chmodSync, unlinkSync } from 'fs';
import { join } from 'path';

export type SingletonLockProbe = 'missing' | 'removed' | 'held' | 'unavailable' | 'skipped';

/**
 * 把 unlink 的错误码映射成可诊断的结果。
 * EBUSY 才是「活实例持有」，EPERM/EACCES 是权限或安全软件。
 */
export function classifyLockFailure(code: string | undefined): SingletonLockProbe {
  if (code === 'ENOENT') {
    return 'missing';
  }
  if (code === 'EBUSY') {
    return 'held';
  }
  return 'unavailable';
}

/** 把探测结果翻译成可操作的错误原因，避免一律报「另一个实例」 */
export function describeLockFailure(probe: SingletonLockProbe): string {
  switch (probe) {
    case 'held':
      return 'another instance is running or the lockfile is held by another process';
    case 'unavailable':
      return 'lockfile exists but cannot be removed/created; check userData permissions or security software';
    case 'removed':
      return 'stale lockfile was removed but the lock still failed; check userData permissions';
    case 'missing':
      return 'lockfile does not exist but could not be created; check userData permissions or security software';
    case 'skipped':
      return 'another instance is running or the POSIX lock is held';
    default:
      return 'single instance lock acquisition failed';
  }
}

/**
 * Windows 上 Electron 的单实例锁是 `<userData>/lockfile`。
 *
 * Chromium 只会把 ERROR_SHARING_VIOLATION 当作「另一个实例」并重试；
 * ERROR_ACCESS_DENIED（只读属性、ACL、delete-pending）会直接中止启动，
 * 表现和「已有实例」完全一样。这里在请求锁之前先做一次安全清理：
 *
 * - 能 unlink：说明没有进程持有，属于残留文件，删除
 * - 只读属性：清掉只读位后重试
 * - EBUSY：活实例持有，绝对不动
 * - 其它：ACL / 安全软件拦截，交给调用方报明确错误
 */
export function clearStaleWindowsLockFile(userDataDir: string): SingletonLockProbe {
  if (process.platform !== 'win32') {
    return 'skipped';
  }

  const lockPath = join(userDataDir, 'lockfile');

  try {
    unlinkSync(lockPath);
    return 'removed';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return 'missing';
    }

    if (code === 'EPERM') {
      try {
        chmodSync(lockPath, 0o666);
        unlinkSync(lockPath);
        return 'removed';
      } catch (retryError) {
        return classifyLockFailure((retryError as NodeJS.ErrnoException).code);
      }
    }

    return classifyLockFailure(code);
  }
}
