import { app } from 'electron';
import { App } from './app';
import { getLogger } from './utils/app-logger';
import { loadProjectEnv, readSandboxEnabled, resolveEnvPath } from './utils/env';
import { clearStaleWindowsLockFile, describeLockFailure } from './utils/singleton-lock';

// 与 scripts/dev.mjs 的 SECOND_INSTANCE_EXIT_CODE 保持一致：
// 用独立退出码把「锁获取失败」和普通退出区分开，开发启动器才能给出准确提示
const SECOND_INSTANCE_EXIT_CODE = 21;

// 可在启动前指定 userData 目录：CI 冒烟与便携模式需要隔离真实用户数据
const userDataOverride = process.env.ELECTRON_USER_DATA_DIR;

if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}

const userDataDir = app.getPath('userData');

// 沙箱必须在 app ready / Chromium 初始化之前决定：
// 只有 .env 里显式写 SECURITY_SANDBOX_ENABLED=false 才关闭，默认保持开启。
const projectEnv = loadProjectEnv();
const sandboxEnabled = readSandboxEnabled(projectEnv);

if (!sandboxEnabled) {
  app.commandLine.appendSwitch('no-sandbox');
}

// Windows 上只读/残留的 lockfile 会让 Electron 以 ACCESS_DENIED 中止，
// 表现和「已有实例」一样；请求锁之前先安全清理一次。
const lockProbe = clearStaleWindowsLockFile(userDataDir);

// 单实例锁 - 确保只运行一个应用实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  getLogger().error(
    `Failed to acquire single instance lock (userData: ${userDataDir}, probe: ${lockProbe}): ${describeLockFailure(lockProbe)}`,
  );
  app.exit(SECOND_INSTANCE_EXIT_CODE);
} else {
  // 创建App实例
  const appInstance = new App();
  const logger = appInstance.getLogger();

  // 同时记录「配置值」与「实际是否带了 no-sandbox」：
  // 开发态外置盘自动降级时，配置仍是 true，但实际沙箱已被启动器关闭。
  logger.info('Chromium sandbox setting', {
    configured: sandboxEnabled,
    noSandboxSwitch: app.commandLine.hasSwitch('no-sandbox'),
    envFile: resolveEnvPath(),
  });

  // 全局异常兜底：记录后退出，避免静默崩溃
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    // 先刷盘再退出，否则崩溃原因可能还停在队列里
    void logger.flush().finally(() => app.quit());
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });

  // 当尝试运行第二个实例时，激活第一个实例的窗口
  app.on('second-instance', () => {
    logger.info('Second instance detected, showing existing window');
    // 尝试通过窗口管理器显示主窗口
    const mainWindow = appInstance.getWindowManager().getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show(); // 显示隐藏的窗口
      mainWindow.focus();
    } else {
      // 如果主窗口不存在，创建新的主窗口
      appInstance.getWindowManager().createMainWindow();
    }
  });

  appInstance.init().catch((error) => {
    logger.error('Failed to initialize app', error);
    app.quit();
  });
}
