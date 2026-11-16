#!/usr/bin/env node

/**
 * Electron 冒烟测试：用临时 userData + 临时 .env 启动一次真实应用，
 * 校验 .env 配置加载、主窗口创建与单实例锁，然后退出。CI 与本地都能跑。
 *
 * 用法：node scripts/smoke.mjs
 */
import { spawn } from 'child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import electronPath from 'electron';

const root = process.cwd();
const userDataDir = mkdtempSync(join(tmpdir(), 'electron-smoke-'));
const TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 250;
const SECOND_INSTANCE_EXIT_CODE = 21;

const isWindows = process.platform === 'win32';

// 预置一个只读的 lockfile：Windows 上 Electron 会以 ACCESS_DENIED 中止，
// 应用必须在请求单实例锁之前把它清掉；Linux 的锁机制不同，这个文件无害。
const staleLockPath = join(userDataDir, 'lockfile');
writeFileSync(staleLockPath, 'stale', 'utf-8');
chmodSync(staleLockPath, 0o444);

// 项目配置只有一个来源：.env。smoke 用临时文件，避免依赖开发机的本地配置。
const envFilePath = join(userDataDir, '.env');
writeFileSync(
  envFilePath,
  ['THEME=light', 'LANGUAGE=zh-CN', 'WINDOW_WIDTH=1000', 'WINDOW_HEIGHT=700', ''].join('\n'),
  'utf-8',
);

// CI（尤其容器里的 Linux）需要关掉 GPU 与沙箱才能起窗口
const args = ['.', '--disable-gpu'];

if (process.env.CI) {
  args.push('--no-sandbox');
}

const logs = [];

const stop = (child) => {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    return;
  }

  child.kill('SIGTERM');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Windows 上 Chromium 的缓存文件在进程退出后还会短暂占用，重试几次
const removeDirWithRetry = async (dir, attempts = 5) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      await sleep(300);
    }
  }

  console.warn(`[smoke] warning: could not remove temp dir ${dir}`);
};

const fail = (message) => {
  console.error(`[smoke] FAIL: ${message}`);

  if (logs.length > 0) {
    console.error('[smoke] electron output:');
    console.error(logs.join(''));
  }

  process.exit(1);
};

const main = async () => {
  const env = {
    ...process.env,
    ELECTRON_USER_DATA_DIR: userDataDir,
    ELECTRON_ENV_FILE: envFilePath,
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  let exited = false;
  child.on('exit', (code) => {
    exited = true;
    if (code !== 0) {
      logs.push(`\n[smoke] electron exited with code ${code}\n`);
    }
  });

  const logPath = join(userDataDir, 'logs', 'main.log');
  const deadline = Date.now() + TIMEOUT_MS;

  const readLog = () => (existsSync(logPath) ? readFileSync(logPath, 'utf-8') : '');

  // 日志是异步落盘的：只等文件出现就检查内容会撞上竞态，必须轮询到目标行真正出现。
  const waitForLogLine = async (needle) => {
    while (Date.now() < deadline) {
      if (exited) {
        fail(`Electron exited before writing "${needle}"`);
      }

      if (readLog().includes(needle)) {
        return;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    const tail = readLog().split('\n').slice(-15).join('\n');
    fail(`main.log never contained "${needle}"${tail ? `\n--- log tail ---\n${tail}` : ''}`);
  };

  try {
    while (Date.now() < deadline) {
      if (exited) {
        fail('Electron exited before the app finished starting');
      }

      if (existsSync(logPath)) {
        break;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    if (!existsSync(logPath)) {
      fail('logs/main.log was not created in time');
    }

    // 配置只从 .env 读取，先确认它真的被加载，再确认窗口起来
    await waitForLogLine('Project config loaded from');
    await waitForLogLine('Main window created');
    // 启动打点在窗口创建之后，同样要等它落盘
    await waitForLogLine('Startup completed');

    const log = readLog();

    if (/uncaught|Blocked IPC/i.test(log)) {
      fail('main.log contains uncaught errors or blocked IPC calls');
    }

    // 首实例已持有锁：第二实例必须被挡住，并用专用退出码结束
    const second = spawn(electronPath, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    second.stdout.on('data', (chunk) => logs.push(chunk.toString()));
    second.stderr.on('data', (chunk) => logs.push(chunk.toString()));

    const secondCode = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        stop(second);
        resolve(null);
      }, 10_000);

      second.once('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    if (secondCode !== SECOND_INSTANCE_EXIT_CODE) {
      fail(`second instance exited with ${secondCode}, expected ${SECOND_INSTANCE_EXIT_CODE}`);
    }

    console.log(`[smoke] OK: app started, .env loaded + log written under ${userDataDir}`);
  } finally {
    stop(child);
    await waitForExit(child);
    await sleep(300);
    await removeDirWithRetry(userDataDir);
  }
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
