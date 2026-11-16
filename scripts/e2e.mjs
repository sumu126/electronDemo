#!/usr/bin/env node

/**
 * 真实交互 e2e：启动 Vite + Electron，用渲染进程的远程调试端口驱动界面，
 * 走一遍「窗口状态恢复 → 打开配置 → 改主题 → 保存 → 切语言 → 重启再验证」的完整链路。
 *
 * 为什么需要它：单测把 invoke mock 掉之后，像「Vue Proxy 无法结构化克隆」这类问题
 * 在单测里永远是绿的，只有真实 IPC 链路才会暴露；窗口状态恢复同理。
 *
 * 用法：node scripts/e2e.mjs
 */
import { spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import electronPath from 'electron';

const root = process.cwd();
const viteBin = join(root, 'node_modules/vite/bin/vite.js');
const userDataDir = mkdtempSync(join(tmpdir(), 'electron-e2e-'));
const DEBUG_PORT = 9223;
const DEV_URL = 'http://localhost:5173';
const isWindows = process.platform === 'win32';
const TOTAL_TIMEOUT_MS = 120_000;
const SEEDED_WIDTH = 1000;
const SEEDED_HEIGHT = 700;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logs = [];

const spawnChild = (command, args, options = {}) =>
  spawn(command, args, { cwd: root, stdio: 'inherit', ...options });

const killTree = (child) => {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (isWindows) {
    spawnChild('taskkill', ['/pid', String(child.pid), '/f', '/t']);
    return;
  }

  child.kill('SIGTERM');
};

const waitForExit = (child, timeoutMs = 5000) =>
  new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });

const fail = (message) => {
  console.error(`[e2e] FAIL: ${message}`);
  if (logs.length > 0) {
    console.error('[e2e] electron output:');
    console.error(logs.join(''));
  }
  process.exitCode = 1;
  throw new Error(message);
};

// Windows 上 Chromium 的缓存文件在进程退出后还会短暂占用，重试几次再放弃
const removeDirWithRetry = async (dir, attempts = 5) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      await sleep(300);
    }
  }

  console.warn(`[e2e] warning: could not remove temp dir ${dir}`);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const waitFor = async (probe, timeoutMs, message) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await probe()) {
      return;
    }
    await sleep(200);
  }

  fail(message);
};

/** 极简 CDP 客户端：只用到 Runtime.evaluate */
const connectRenderer = async () => {
  let target;

  await waitFor(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const targets = await response.json();
        target = targets.find((item) => item.type === 'page' && item.url.includes('5173'));
        return Boolean(target);
      } catch {
        return false;
      }
    },
    30_000,
    'renderer debug target not available',
  );

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });

  let seq = 0;

  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const id = (seq += 1);

      const onMessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id !== id) {
          return;
        }

        socket.removeEventListener('message', onMessage);

        if (data.error) {
          reject(new Error(data.error.message));
          return;
        }

        if (data.result?.exceptionDetails) {
          reject(new Error(data.result.exceptionDetails.text ?? 'evaluation threw'));
          return;
        }

        resolve(data.result?.result?.value);
      };

      socket.addEventListener('message', onMessage);
      socket.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });

  return { evaluate, close: () => socket.close() };
};

const configPath = () => join(userDataDir, 'config.json');
const readConfig = () => JSON.parse(readFileSync(configPath(), 'utf-8'));

const env = { ...process.env, ELECTRON_USER_DATA_DIR: userDataDir };
delete env.ELECTRON_RUN_AS_NODE;

let electron = null;

const launchRenderer = async () => {
  const args = ['.', '--disable-gpu', `--remote-debugging-port=${DEBUG_PORT}`];
  if (process.env.CI) {
    args.push('--no-sandbox');
  }

  electron = spawn(electronPath, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  electron.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  electron.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  return connectRenderer();
};

const stopRenderer = async () => {
  killTree(electron);
  await waitForExit(electron);
  electron = null;
  // 等调试端口释放，避免第二次启动连到已退出的旧目标
  await sleep(500);
};

const assertWindowSize = async (evaluate, label, expected) => {
  const expectedWidth = expected?.width ?? SEEDED_WIDTH;
  const expectedHeight = expected?.height ?? SEEDED_HEIGHT;
  const width = await evaluate('window.outerWidth');
  const height = await evaluate('window.outerHeight');

  // 允许 16px 误差：Windows 的窗口边框/阴影度量与 BrowserWindow bounds 不完全相等
  assert(
    Math.abs(width - expectedWidth) <= 16 && Math.abs(height - expectedHeight) <= 16,
    `${label}: expected window ~${expectedWidth}x${expectedHeight}, got ${width}x${height}`,
  );
};

const main = async () => {
  // 预置窗口状态，第一次启动就应该按它建窗；关闭时再写回同一份状态
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(
    configPath(),
    JSON.stringify({ window: { width: SEEDED_WIDTH, height: SEEDED_HEIGHT } }, null, 2),
    'utf-8',
  );

  const vite = spawn(process.execPath, [viteBin, '--port', '5173', '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });

  try {
    await waitFor(
      async () => {
        try {
          await fetch(DEV_URL);
          return true;
        } catch {
          return false;
        }
      },
      30_000,
      'Vite dev server did not start',
    );

    const renderer = await launchRenderer();
    const { evaluate } = renderer;

    // 1. 应用已挂载，且按预置状态恢复窗口尺寸
    await waitFor(
      async () => (await evaluate(`Boolean(document.querySelector('.app-container'))`)) === true,
      15_000,
      'app container not rendered',
    );
    await assertWindowSize(evaluate, 'first launch');

    // 2. 打开配置面板
    await evaluate(`document.querySelector('.btn-success').click()`);
    await waitFor(
      async () => (await evaluate(`Boolean(document.querySelector('.config-panel'))`)) === true,
      5_000,
      'config panel did not open',
    );

    // 3. 改主题并保存（走真实 IPC：Proxy → toPlain → 主进程 schema 校验 → 落盘）
    await evaluate(`
      (() => {
        const select = document.querySelectorAll('.config-panel select')[0];
        select.value = 'dark';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.config-panel .btn-primary').click();
      })()
    `);

    await waitFor(
      () => existsSync(configPath()) && readConfig().theme === 'dark',
      10_000,
      'theme was not persisted as dark',
    );
    assert(
      (await evaluate(
        `document.querySelector('.config-panel .error-message')?.textContent ?? null`,
      )) === null,
      'config panel shows an error after saving theme',
    );

    // 4. 切换语言，确认界面文案跟着变（i18n 由配置驱动）
    await evaluate(`
      (() => {
        const select = document.querySelectorAll('.config-panel select')[1];
        select.value = 'en-US';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.config-panel .btn-primary').click();
      })()
    `);

    await waitFor(() => readConfig().language === 'en-US', 10_000, 'language was not persisted');

    await waitFor(
      async () =>
        (await evaluate(`document.body.textContent.includes('Application settings')`)) === true,
      5_000,
      'UI text did not switch to English',
    );

    // 5. 主题真的生效：<html data-theme="dark">
    assert(
      (await evaluate(`document.documentElement.dataset.theme`)) === 'dark',
      'data-theme is not dark after switching theme',
    );

    renderer.close();

    // 6. 真正重启一次：窗口状态、主题、语言都应从 config.json 恢复
    const savedWindow = readConfig().window;
    assert(
      Math.abs(savedWindow.width - SEEDED_WIDTH) <= 16 &&
        Math.abs(savedWindow.height - SEEDED_HEIGHT) <= 16,
      `saved window state is not derived from seed: ${savedWindow.width}x${savedWindow.height}`,
    );

    await stopRenderer();

    const second = await launchRenderer();
    const evaluateSecond = second.evaluate;

    await waitFor(
      async () =>
        (await evaluateSecond(`Boolean(document.querySelector('.app-container'))`)) === true,
      15_000,
      'app container not rendered after restart',
    );

    await assertWindowSize(evaluateSecond, 'after restart', savedWindow);

    assert(
      readConfig().theme === 'dark' && readConfig().language === 'en-US',
      'theme or language was not persisted across restart',
    );

    await waitFor(
      async () =>
        (await evaluateSecond(`document.body.textContent.includes('System info')`)) === true,
      5_000,
      'UI text did not restore to English after restart',
    );

    second.close();
    console.log('[e2e] OK: 窗口状态恢复、配置保存、主题应用、语言切换与重启恢复全部通过真实链路');
  } finally {
    killTree(electron);
    await waitForExit(electron);
    killTree(vite);
    await sleep(800);
    await removeDirWithRetry(userDataDir);
  }
};

const timeout = setTimeout(() => {
  console.error('[e2e] FAIL: global timeout');
  process.exit(1);
}, TOTAL_TIMEOUT_MS);
timeout.unref();

main()
  .then(() => {
    clearTimeout(timeout);
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    clearTimeout(timeout);
    console.error(`[e2e] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
