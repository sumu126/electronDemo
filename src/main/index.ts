import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { WindowManager } from './managers/window.manager';
import { IpcManager } from './ipc-manager/ipc.manager';
import { ModuleManager } from './managers/module.manager';
import { ConfigModule } from './modules/config.module';
import { Logger } from './utils/logger';

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
      this.moduleManager
        .destroy()
        .catch(error => this.logger.error('Failed to destroy modules', error))
        .finally(() => app.quit());
    });

    // 当所有窗口关闭时退出应用（macOS除外）
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
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
    app.quit();
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

  appInstance.init().catch(error => {
    logger.error('Failed to initialize app', error);
    app.quit();
  });
}