#!/usr/bin/env node

/**
 * 确保本地 .env 存在：
 * 仓库只跟踪 .env.example，首次运行/构建时复制一份本地 .env。
 * 已存在的 .env 不会被覆盖。
 */
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const envPath = join(root, '.env');
const examplePath = join(root, '.env.example');

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log('[env] .env not found, copied .env.example -> .env');
}
