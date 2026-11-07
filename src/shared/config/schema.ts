import type { AppConfig } from '../types';
import { SUPPORTED_LOCALES } from '../i18n';

/**
 * 配置 schema：既是校验白名单，也是唯一的结构描述。
 * 渲染进程通过 config:update 传入的任意 JSON 都要先过这里，
 * 避免未知键永久驻留、错误类型污染运行时，以及 `__proto__` 这类原型键。
 */

type PrimitiveType = 'string' | 'number' | 'boolean';

type EnumType = readonly string[];

type SchemaNode = PrimitiveType | EnumType | SchemaObject;

interface SchemaObject {
  readonly [key: string]: SchemaNode;
}

// 原型链相关的键一律拒绝，避免 deepMerge 时改写原型
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const CONFIG_SCHEMA: SchemaObject = {
  appName: 'string',
  version: 'string',
  theme: ['light', 'dark', 'auto'] as const,
  language: SUPPORTED_LOCALES,
  window: {
    width: 'number',
    height: 'number',
    x: 'number',
    y: 'number',
    maximized: 'boolean',
  },
  features: {
    developerTools: 'boolean',
    analytics: 'boolean',
    autoUpdate: 'boolean',
  },
  tray: {
    hasShownFirstTimeNotice: 'boolean',
    balloonNotificationEnabled: 'boolean',
  },
};

const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

const isSchemaObject = (node: SchemaNode): node is SchemaObject =>
  typeof node === 'object' && !Array.isArray(node);

const isEnumType = (node: SchemaNode): node is EnumType => Array.isArray(node);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const typeName = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
};

function validateNode(path: string, value: unknown, node: SchemaNode): unknown {
  if (typeof node === 'string') {
    if (node === 'number') {
      if (typeof value !== 'number') {
        throw new Error(`${path} 必须是 number，收到 ${typeName(value)}`);
      }
      if (!Number.isFinite(value)) {
        throw new Error(`${path} 必须是有限数字，收到 ${String(value)}`);
      }
      return value;
    }

    if (typeof value !== node) {
      throw new Error(`${path} 必须是 ${node}，收到 ${typeName(value)}`);
    }

    return value;
  }

  if (isEnumType(node)) {
    if (typeof value !== 'string' || !node.includes(value)) {
      throw new Error(`${path} 必须是 ${node.join(' / ')} 之一，收到 ${String(value)}`);
    }
    return value;
  }

  if (!isPlainObject(value)) {
    throw new Error(`${path} 必须是对象，收到 ${typeName(value)}`);
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`${childPath} 是被禁止的键`);
    }

    if (!hasOwn(node, key)) {
      throw new Error(`${childPath} 不是已知配置项`);
    }

    result[key] = validateNode(childPath, child, node[key]);
  }

  return result;
}

/**
 * 校验并裁剪一次配置更新。
 * 未知键、类型不符、非法枚举、原型键都会抛错，错误信息带完整键路径。
 */
export function sanitizeConfigUpdate(updates: unknown): Partial<AppConfig> {
  if (!isPlainObject(updates)) {
    throw new Error(`配置更新必须是对象，收到 ${typeName(updates)}`);
  }

  return validateNode('config', updates, CONFIG_SCHEMA) as Partial<AppConfig>;
}

function prune(value: unknown, node: SchemaObject): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (!isPlainObject(value)) {
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    if (!hasOwn(node, key)) {
      continue;
    }

    const childNode = node[key];
    result[key] = isSchemaObject(childNode) ? prune(child, childNode) : child;
  }

  return result;
}

/** 去掉磁盘配置里不属于 schema 的键（含嵌套），返回可安全合并的对象 */
export function stripUnknownConfigKeys(config: unknown): Record<string, unknown> {
  return prune(config, CONFIG_SCHEMA);
}

function collectUnknown(value: unknown, node: SchemaObject, prefix: string, out: string[]): void {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (!hasOwn(node, key)) {
      out.push(path);
      continue;
    }

    const childNode = node[key];

    if (isSchemaObject(childNode)) {
      collectUnknown(value[key], childNode, path, out);
    }
  }
}

/** 列出配置中所有 schema 之外的键路径，用于加载时告警 */
export function findUnknownConfigKeys(config: unknown): string[] {
  const unknown: string[] = [];
  collectUnknown(config, CONFIG_SCHEMA, '', unknown);
  return unknown;
}
