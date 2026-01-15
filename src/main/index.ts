import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { WindowManager } from './managers/window.manager';
import { IpcManager } from './ipc/ipc.manager';
import { ModuleManager } from './managers/module.manager';

class App {
  private windowManager: WindowManager;
  private moduleManager: ModuleManager;
  private ipcManager: IpcManager;

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
    
    // 设置IPC处理器（现在模块已经初始化）
    this.ipcManager.setupHandlers();
    
    // 创建主窗口
    const mainWindow = this.windowManager.createMainWindow();
    
    // 加载应用
    if (app.isPackaged) {
      // 在打包版本中，使用资源路径
      mainWindow.loadFile(join(process.resourcesPath, 'dist/index.html'));
    } else {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    }
    
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
}

const appInstance = new App();

appInstance.init().catch(error => {
  console.error('Failed to initialize app:', error);
  app.quit();
});