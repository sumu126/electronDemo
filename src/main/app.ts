import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { WindowManager } from './managers/window.manager';
import { IpcManager } from './ipc-manager/ipc.manager';
import { ModuleManager } from './managers/module.manager';
import { applyApplicationMenu } from './managers/menu.manager';
import { isConfigModule } from './modules/config.module';
import { Logger } from './utils/logger';
import { initLogger } from './utils/app-logger';
import { APP_CONSTANTS } from '@shared/constants';

// 退出时等待模块清理的最长时间，避免 destroy 卡住导致进程无法退出
const MODULE_DESTROY_TIMEOUT_MS = 3000;

export class App {
  private windowManager: WindowManager;
  private moduleManager: ModuleManager;
  private ipcManager: IpcManager;
  private logger: Logger;
  private isQuitting = false;
  private readonly startedAt = Date.now();

  constructor() {
    // 初始化全局日志入口：此后各模块都用 getLogger() 记录，无需层层注入
    this.logger = initLogger(join(app.getPath('userData'), 'logs', 'main.log'));
    this.windowManager = new WindowManager();
    this.moduleManager = new ModuleManager();
    // 延迟初始化IPC管理器直到模块被加载
    this.ipcManager = new IpcManager(ipcMain, this.moduleManager);
  }

  public async init(): Promise<void> {
    await app.whenReady();
    const readyAt = Date.now();

    // Windows 上任务栏身份与托盘气泡通知依赖 AppUserModelId，缺失时通知可能不显示
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_CONSTANTS.APP_ID);
    }

    this.logger.info('Application starting');

    // 初始化模块
    await this.moduleManager.init();
    const modulesReadyAt = Date.now();

    // 设置配置模块到窗口管理器
    const configModule = this.moduleManager.getModule('ConfigModule', isConfigModule);
    if (configModule) {
      this.windowManager.setConfigModule(configModule);
    }

    // 设置IPC处理器（现在模块已经初始化）
    this.ipcManager.setupHandlers();
    const ipcReadyAt = Date.now();

    // 默认拒绝所有 Web 权限（摄像头、麦克风、通知等按需再开放）。
    // request 管弹窗授权，check 管同步查询；只设前者时，部分 API 仍可能拿到放行结果。
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);

    // 应用菜单用原生 role，菜单文字跟随系统语言；开发者工具项由配置决定
    applyApplicationMenu({
      allowDevTools: Boolean(configModule?.getValue<boolean>('features.developerTools')),
    });

    // 创建并加载主窗口（内部统一处理开发/打包两种加载方式）
    const mainWindow = this.windowManager.createMainWindow();
    const windowCreatedAt = Date.now();
    // 记录真实 bounds：e2e 依赖它校验「.env 的 WINDOW_* 是否真的作用到 BrowserWindow」，
    // 渲染端的 window.outerWidth 在 Windows 上会受边框/DPI 影响，不能作为断言依据
    this.logger.info('Main window created', mainWindow.getBounds());

    // 启动耗时分段打点，便于判断慢在哪一段（Electron 自身启动不在此区间内）
    this.logger.info('Startup completed', {
      ready: readyAt - this.startedAt,
      modules: modulesReadyAt - readyAt,
      ipc: ipcReadyAt - modulesReadyAt,
      window: windowCreatedAt - ipcReadyAt,
      total: windowCreatedAt - this.startedAt,
    });

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
