import { app, BrowserWindow, ipcMain } from 'electron';
import { WindowManager } from './managers/window.manager';
import { IpcManager } from './ipc-manager/ipc.manager';
import { ModuleManager } from './managers/module.manager';
import { ConfigModule } from './modules/config.module';

class App {
  private windowManager: WindowManager;
  private moduleManager: ModuleManager;
  private ipcManager: IpcManager;
  private isQuitting = false;

  constructor() {
    this.windowManager = new WindowManager();
    this.moduleManager = new ModuleManager();
    // 延迟初始化IPC管理器直到模块被加载
    this.ipcManager = new IpcManager(ipcMain, this.moduleManager);
  }

  public async init(): Promise<void> {
    await app.whenReady();
    
    // 初始化模块
    await this.moduleManager.init();
    
    // 设置配置模块到窗口管理器
    const configModule = this.moduleManager.getModule<ConfigModule>('ConfigModule');
    if (configModule) {
      this.windowManager.setConfigModule(configModule);
    }
    
    // 设置IPC处理器（现在模块已经初始化）
    this.ipcManager.setupHandlers();
    
    // 创建并加载主窗口（内部统一处理开发/打包两种加载方式）
    this.windowManager.createMainWindow();

    // 设置应用退出时的处理：等待模块清理完成后再真正退出
    app.on('before-quit', (event) => {
      if (this.isQuitting) {
        return;
      }
      this.isQuitting = true;
      event.preventDefault();
      this.windowManager.markQuitting();
      this.windowManager.destroyTray();
      this.moduleManager
        .destroy()
        .catch(error => console.error('Failed to destroy modules:', error))
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
}

// 单实例锁 - 确保只运行一个应用实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance of the app is already running. Quitting this instance.');
  app.quit();
} else {
  // 创建App实例
  const appInstance = new App();
  
  // 当尝试运行第二个实例时，激活第一个实例的窗口
  app.on('second-instance', () => {
    console.log('Second instance detected, showing existing window');
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
    console.error('Failed to initialize app:', error);
    app.quit();
  });
}