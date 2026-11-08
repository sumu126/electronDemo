import fs from 'fs/promises';

/**
 * 路径与文件工具（主进程与渲染进程共用，**不依赖 electron**）。
 */

/**
 * 检查路径是否存在
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保目录存在，如果不存在则创建
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!(await pathExists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// 纯函数工具统一从 helpers 导出
export { deepMerge } from './helpers';
