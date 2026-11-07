#!/usr/bin/env node

/**
 * 开发启动器：构建主进程 → 起 Vite → 起 Electron，
 * 并在 src/main、src/preload、src/shared 变化时自动重建主进程并重启 Electron。
 *
 * 之前改主进程必须手动中断再重跑 electron:dev，渲染进程有热更新、主进程没有，
 * 是这套脚手架日常开发里最费时间的一环。
 */
import { spawn } from 'child_process';
import { watch } from 'fs';
import { join } from 'path';
import electronPath from 'electron';

const root = process.cwd();
const viteBin = join(root, 'node_modules/vite/bin/vite.js');
const WATCH_DIRS = ['src/main', 'src/preload', 'src/shared'];
const DEV_SERVER_URL = 'http://localhost:5173';
const REBUILD_DEBOUNCE_MS = 250;
const isWindows = process.platform === 'win32';

let viteProcess = null;
let electronProcess = null;
let rebuilding = false;
let debounceTimer = null;
let shuttingDown = false;

const log = (message) => console.log(`[dev] ${message}`);

const spawnChild = (command, args, options = {}) =>
  spawn(command, args, { cwd: root, stdio: 'inherit', ...options });

/** Windows 上 kill 只结束父进程，需要连带子进程一起收掉 */
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

const buildMain = () =>
  new Promise((resolve, reject) => {
    const build = spawnChild(process.execPath, [viteBin, 'build', '--mode', 'electron']);

    build.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`main build failed with exit code ${code}`));
    });
  });

const waitForServer = async (timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await fetch(DEV_SERVER_URL);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Vite dev server not ready at ${DEV_SERVER_URL}`);
};

const startElectron = () => {
  const env = { ...process.env };
  // Electron 系终端（VS Code 等）会带上这个变量，会让 Electron 退化成普通 Node
  delete env.ELECTRON_RUN_AS_NODE;

  electronProcess = spawnChild(electronPath, ['.'], { env });

  electronProcess.on('exit', (code) => {
    electronProcess = null;

    // 用户关掉应用（或重启 Electron）时结束整个开发会话
    if (!shuttingDown && !rebuilding) {
      log('Electron exited, stopping dev session');
      shutdown(code ?? 0);
    }
  });
};

const stopElectron = () =>
  new Promise((resolve) => {
    if (!electronProcess) {
      resolve();
      return;
    }

    const target = electronProcess;
    target.once('exit', () => resolve());
    killTree(target);
  });

const restartElectron = async () => {
  log('restarting Electron...');
  await stopElectron();
  startElectron();
};

const rebuildAndRestart = async () => {
  if (rebuilding) {
    return;
  }

  rebuilding = true;

  try {
    log('main process changed, rebuilding...');
    await buildMain();
    await restartElectron();
    log('main process restarted');
  } catch (error) {
    // 构建失败时保留旧进程，修好文件后会自动重试
    console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    rebuilding = false;
  }
};

const scheduleRebuild = (filename) => {
  if (!filename || !/\.(ts|mts|js|mjs|cjs|vue)$/.test(filename)) {
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void rebuildAndRestart();
  }, REBUILD_DEBOUNCE_MS);
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log('shutting down');
  killTree(electronProcess);
  killTree(viteProcess);
  process.exit(code);
};

const main = async () => {
  log('building main process');
  await buildMain();

  log(`starting Vite dev server at ${DEV_SERVER_URL}`);
  viteProcess = spawnChild(process.execPath, [viteBin, '--port', '5173', '--strictPort']);

  viteProcess.on('exit', (code) => {
    if (!shuttingDown) {
      log(`Vite exited with code ${code}`);
      shutdown(code ?? 0);
    }
  });

  await waitForServer();
  startElectron();

  for (const dir of WATCH_DIRS) {
    watch(join(root, dir), { recursive: true }, (_event, filename) => {
      scheduleRebuild(filename);
    });
  }

  log('watching src/main, src/preload, src/shared');
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
