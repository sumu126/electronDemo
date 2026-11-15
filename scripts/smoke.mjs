#!/usr/bin/env node

/**
 * Electron 冒烟测试：用临时 userData 启动一次真实应用，
 * 校验配置落盘与主窗口日志，然后退出。CI 与本地都能跑。
 *
 * 用法：node scripts/smoke.mjs
 */
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import electronPath from 'electron';

const root = process.cwd();
const userDataDir = mkdtempSync(join(tmpdir(), 'electron-smoke-'));
const TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 250;

const isWindows = process.platform === 'win32';

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
  const env = { ...process.env, ELECTRON_USER_DATA_DIR: userDataDir };
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

  const configPath = join(userDataDir, 'config.json');
  const logPath = join(userDataDir, 'logs', 'main.log');
  const deadline = Date.now() + TIMEOUT_MS;

  const readLog = () => (existsSync(logPath) ? readFileSync(logPath, 'utf-8') : '');

  // 日志是异步落盘的，且 config.json 会先于「Main window created」写入：
  // 只等文件出现就检查内容会撞上竞态，必须轮询到目标行真正出现。
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

      if (existsSync(configPath) && existsSync(logPath)) {
        break;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    if (!existsSync(configPath) || !existsSync(logPath)) {
      fail('config.json or logs/main.log was not created in time');
    }

    await waitForLogLine('Main window created');
    // 启动打点在窗口创建之后，同样要等它落盘
    await waitForLogLine('Startup completed');

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    if (!config.appName) {
      fail('config.json has no appName');
    }

    const log = readLog();

    if (/uncaught|Blocked IPC/i.test(log)) {
      fail('main.log contains uncaught errors or blocked IPC calls');
    }

    console.log(`[smoke] OK: app started, config + log written under ${userDataDir}`);
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
