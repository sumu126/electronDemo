import fs from 'fs';
import path from 'path';
import type { Module } from './module.types';
import type { ModuleRegistry } from './module-registry';

// 用户模块约定：CommonJS 文件，导出一个模块对象或返回模块对象的工厂函数
const MODULE_EXTENSIONS = ['.cjs', '.js'];

export type ModuleRequire = (filePath: string) => unknown;

export function isModule(value: unknown): value is Module {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Module;
  return typeof candidate.name === 'string' && typeof candidate.init === 'function';
}

export function resolveModuleExport(exported: unknown): Module | null {
  const candidate =
    exported && typeof exported === 'object' && 'default' in exported
      ? (exported as { default: unknown }).default
      : exported;

  const module = typeof candidate === 'function' ? (candidate as () => unknown)() : candidate;

  return isModule(module) ? module : null;
}

/**
 * 扫描目录并注册用户模块。
 * 单个模块加载/初始化失败不会影响其它模块（失败隔离）。
 */
export async function loadModulesFromDirectory(
  directory: string,
  registry: ModuleRegistry,
  requireModule: ModuleRequire,
): Promise<string[]> {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const loaded: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !MODULE_EXTENSIONS.includes(path.extname(entry.name))) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

    try {
      const module = resolveModuleExport(requireModule(filePath));

      if (!module) {
        console.warn(`Skip invalid module: ${filePath}`);
        continue;
      }

      if (await registry.register(module)) {
        loaded.push(module.name);
      }
    } catch (error) {
      console.error(`Failed to load module ${filePath}:`, error);
    }
  }

  return loaded;
}
