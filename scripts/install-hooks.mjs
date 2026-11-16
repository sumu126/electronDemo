#!/usr/bin/env node

/**
 * 无依赖安装 git 钩子：npm install / npm ci 后自动生效。
 * 提交前跑本地四道门禁，避免「改完忘了验证」直接落到历史里。
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
// npm install / npm ci 后先补齐本地 .env，新克隆不必再手动复制模板
import './ensure-env.mjs';

const repoRoot = process.cwd();
const gitDir = join(repoRoot, '.git');

if (!existsSync(gitDir)) {
  console.log('Not a git repository, skip hook installation.');
  process.exit(0);
}

const hooksDir = join(gitDir, 'hooks');
const hookPath = join(hooksDir, 'pre-commit');

// 钩子脚本保持纯 ASCII：不同终端/代码页下中文注释会显示为乱码
const hook = `#!/bin/sh
# Pre-commit gates. Skip once with: SKIP_GATES=1 git commit ...
set -e

if [ "\${SKIP_GATES:-0}" = "1" ]; then
  echo "SKIP_GATES=1 set, skipping pre-commit gates"
  exit 0
fi

echo "== typecheck =="
npm run typecheck
echo "== lint =="
npm run lint
echo "== format:check =="
npm run format:check
echo "== test =="
npm test
echo "== build =="
npm run build
`;

mkdirSync(hooksDir, { recursive: true });
writeFileSync(hookPath, hook, { encoding: 'utf-8' });

try {
  chmodSync(hookPath, 0o755);
} catch {
  // Windows 上 chmod 可能不生效，git 仍会执行该脚本
}

console.log(`Installed pre-commit hook: ${hookPath}`);
