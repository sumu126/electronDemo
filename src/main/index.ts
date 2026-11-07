import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { WindowManager } from './managers/window.manager';
import { IpcManager } from './ipc-manager/ipc.manager';
import { ModuleManager } from './managers/module.manager';
import { ConfigModule } from './modules/config.module';
import { Logger } from './utils/logger';
import { APP_CONSTANTS } from '@shared/constants';

// 退出时等待模块清理的最长时间，避免 destroy 卡住导致进程无法退出
const MODULE_DESTROY_TIMEOUT_MS = 3000;

class App {
  private windowManager: WindowManager;
  private moduleManager: ModuleManager;
  private ipcManager: IpcManager;
  private logger: Logger;
  private isQuitting = false;

  constructor() {
    this.logger = new Logger(join(app.getPath('userData'), 'logs', 'main.log'));
    this.windowManager = new WindowManager();
    this.moduleManager = new ModuleManager();
    // 延迟初始化IPC管理器直到模块被加载
    this.ipcManager = new IpcManager(ipcMain, this.moduleManager);
  }

  public async init(): Promise<void> {
    await app.whenReady();

    // Windows 上任务栏身份与托盘气泡通知依赖 AppUserModelId，缺失时通知可能不显示
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_CONSTANTS.APP_ID);
    }

    this.logger.info('Application starting');

    // 初始化模块
    await this.moduleManager.init();

    // 设置配置模块到窗口管理器
    const configModule = this.moduleManager.getModule<ConfigModule>('ConfigModule');
    if (configModule) {
      this.windowManager.setConfigModule(configModule);
    }

    // 设置IPC处理器（现在模块已经初始化）
    this.ipcManager.setupHandlers();

    // 默认拒绝所有 Web 权限请求（摄像头、麦克风、通知等按需再开放）
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });

    // 创建并加载主窗口（内部统一处理开发/打包两种加载方式）
    this.windowManager.createMainWindow();
    this.logger.info('Main window created');

    // 设置应用退出时的处理：等待模块清理完成后再真正退出
    app.on('before-quit', (event) => {
      if (this.isQuitting) {
        return;
      }
      this.isQuitting = true;
      event.preventDefault();
      this.logger.info('Application quitting');
      this.windowManager.markQuitting();
      this.windowManager.destroyTray();

      // 模块清理最长等 3 秒：destroy 卡住时不能让应用永远退不出去
      const forceQuitTimer = setTimeout(() => {
        this.logger.warn(`Module cleanup exceeded ${MODULE_DESTROY_TIMEOUT_MS}ms, forcing quit`);
        void this.logger.flush().finally(() => app.quit());
      }, MODULE_DESTROY_TIMEOUT_MS);

      this.moduleManager
        .destroy()
        .catch((error) => this.logger.error('Failed to destroy modules', error))
        .finally(() => {
          clearTimeout(forceQuitTimer);
          // 退出前把日志队列刷完，崩溃原因才不会丢在缓冲区里
          void this.logger.flush().finally(() => app.quit());
        });
    });

    // 当所有窗口关闭时退出应用（macOS除外）
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // 退出流程被打断后再次激活：复位标志，恢复「关闭到托盘」的语义
        this.isQuitting = false;
        this.windowManager.resetQuitting();
        this.windowManager.createMainWindow();
      }
    });
  }

  public getWindowManager(): WindowManager {
    return this.windowManager;
  }

  public getLogger(): Logger {
    return this.logger;
  }
}

// 单实例锁 - 确保只运行一个应用实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance of the app is already running. Quitting this instance.');
  app.quit();
} else {
  // 创建App实例
  const appInstance = new App();
  const logger = appInstance.getLogger();

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
