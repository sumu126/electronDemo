#!/usr/bin/env node

/**
 * 开发启动器：构建主进程 → 起 Vite → 起 Electron，
 * 并在 src/main、src/preload、src/shared 变化时自动重建主进程并重启 Electron。
 *
 * 之前改主进程必须手动中断再重跑 electron:dev，渲染进程有热更新、主进程没有，
 * 是这套脚手架日常开发里最费时间的一环。
 */
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, watch } from 'fs';
import { join } from 'path';
import electronPath from 'electron';

const root = process.cwd();
const viteBin = join(root, 'node_modules/vite/bin/vite.js');
const WATCH_DIRS = ['src/main', 'src/preload', 'src/shared'];
const DEV_SERVER_URL = 'http://localhost:5173';
const REBUILD_DEBOUNCE_MS = 250;
const QUICK_EXIT_MS = 5000;
// Windows 上 Chromium 沙箱初始化失败时的退出码（0x80000003）
const SANDBOX_CRASH_EXIT_CODE = 2147483651;
// 与 src/main/index.ts 的 SECOND_INSTANCE_EXIT_CODE 保持一致
const SECOND_INSTANCE_EXIT_CODE = 21;
// 开发态用项目内 userData：不同克隆/正式包不再共用单实例锁，也不污染用户配置
const devUserDataDir =
  process.env.ELECTRON_USER_DATA_DIR ||
  join(root, 'node_modules', '.cache', 'electron-dev-user-data');
const mainLogPath = join(devUserDataDir, 'logs', 'main.log');
const isWindows = process.platform === 'win32';

let viteProcess = null;
let electronProcess = null;
let electronStartedAt = 0;
let rebuilding = false;
let debounceTimer = null;
let shuttingDown = false;
let useNoSandbox = false;

const log = (message) => console.log(`[dev] ${message}`);

// Windows 下 Electron 是 GUI 程序，stdout 不一定出现在当前终端；
// 这里既转发它的输出，也在提前退出时直接打印日志尾部。
const printMainLogTail = (lines = 15) => {
  if (!existsSync(mainLogPath)) {
    return;
  }

  try {
    const tail = readFileSync(mainLogPath, 'utf-8').trimEnd().split('\n').slice(-lines);
    console.log('----- main.log tail -----');
    console.log(tail.join('\n'));
    console.log('-------------------------');
  } catch {
    // 读不到日志就不阻塞退出
  }
};

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
  const env = { ...process.env, ELECTRON_USER_DATA_DIR: devUserDataDir };
  // Electron 系终端（VS Code 等）会带上这个变量，会让 Electron 退化成普通 Node
  delete env.ELECTRON_RUN_AS_NODE;

  const args = ['.'];
  if (useNoSandbox) {
    args.push('--no-sandbox');
    log('Electron 以 --no-sandbox 运行（当前环境 Chromium 沙箱不可用，仅影响开发态）');
  }

  electronStartedAt = Date.now();
  // 用管道而不是 inherit：Windows 下 GUI 程序的 stdout/stderr 才能被拿到并转发
  electronProcess = spawnChild(electronPath, args, {
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  electronProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
  electronProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));

  electronProcess.on('exit', (code) => {
    electronProcess = null;

    // 用户关掉应用（或重启 Electron）时结束整个开发会话
    if (!shuttingDown && !rebuilding) {
      const exitCode = code ?? 0;
      const quickExit = Date.now() - electronStartedAt < QUICK_EXIT_MS;

      // 外置盘等路径下 Chromium 沙箱可能直接原生崩溃；开发态自动降级重试一次
      if (exitCode === SANDBOX_CRASH_EXIT_CODE && !useNoSandbox) {
        useNoSandbox = true;
        log('Electron 原生退出 0x80000003：当前路径无法启用 Chromium 沙箱。');
        log('开发态自动加 --no-sandbox 重试一次；生产构建不受影响。');
        startElectron();
        return;
      }

      log(`Electron exited with code ${exitCode}`);

      if (exitCode === SECOND_INSTANCE_EXIT_CODE) {
        log('Electron 没有启动：单实例锁获取失败。');
        log('probe=held 表示同一 userData 下已有实例（常见是关窗后缩到托盘）。');
        log('probe=unavailable 表示 lockfile 无法删除/创建，请检查权限或安全软件。');
        log('probe=skipped 表示当前平台不做 lockfile 清理（Linux/macOS），通常是已有实例。');
      } else if (quickExit) {
        log('Electron 启动后很快退出，下面是 main.log 末尾，便于定位：');
      }

      if (exitCode === SECOND_INSTANCE_EXIT_CODE || quickExit) {
        printMainLogTail();
      }

      log(`dev userData: ${devUserDataDir}`);
      log(`main.log: ${mainLogPath}`);
      log('Electron exited, stopping dev session');
      shutdown(exitCode);
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
  mkdirSync(devUserDataDir, { recursive: true });

  log('building main process');
  await buildMain();

  log(`starting Vite dev server at ${DEV_SERVER_URL}`);
  log(`dev userData: ${devUserDataDir}`);
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
