import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { SystemInfoHandler } from '../ipc/system.handler';
import { ConfigHandler } from '../ipc/config.handler';
import { WindowHandler } from '../ipc/window.handler';
import { LogReportHandler } from '../ipc/log.handler';
import { IPC_CHANNELS } from '@shared/constants';
import { isTrustedSenderUrl } from '../ipc/sender';
import { ModuleManager } from '../managers/module.manager';
import { ConfigModule } from '../modules/config.module';
import { getLogger } from '../utils/app-logger';
import type { IpcChannel } from '@shared/types';

export interface IpcHandler {
  // 通道名受 IpcChannel 约束：写错或写出未声明的通道会编译失败
  channel: IpcChannel;
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
}

export class IpcManager {
  private ipcMain: IpcMain;
  private handlers: Map<string, IpcHandler> = new Map();
  private systemInfoHandler: SystemInfoHandler;
  private configHandler: ConfigHandler | null = null;
  private windowHandler: WindowHandler;
  private logReportHandler: LogReportHandler;
  private moduleManager: ModuleManager;

  constructor(ipcMain: IpcMain, moduleManager: ModuleManager) {
    this.ipcMain = ipcMain;
    this.moduleManager = moduleManager;

    // 初始化处理器
    this.systemInfoHandler = new SystemInfoHandler();
    this.windowHandler = new WindowHandler();
    this.logReportHandler = new LogReportHandler();
  }

  public registerHandler(handler: IpcHandler): void {
    this.handlers.set(handler.channel, handler);
    this.ipcMain.handle(handler.channel, (event, ...args) => {
      const senderUrl = event.senderFrame?.url ?? '';
      if (!isTrustedSenderUrl(senderUrl, Boolean(process.defaultApp))) {
        throw new Error(`Blocked IPC call from untrusted sender: ${senderUrl || 'unknown'}`);
      }
      return handler.handler(event, ...args);
    });
  }

  public setupHandlers(): void {
    // 初始化需要模块的处理器
    this.initializeConfigHandler();

    // 注册通用IPC处理器
    this.registerPingHandler();

    // 注册系统信息处理器
    this.registerSystemInfoHandlers();

    // 注册配置处理器
    this.registerConfigHandlers();

    // 注册窗口操作处理器
    this.registerWindowHandlers();

    // 注册渲染进程日志上报处理器
    this.registerLogReportHandler();
  }

  private initializeConfigHandler(): void {
    // 获取配置模块实例
    const configModule = this.moduleManager.getModule<ConfigModule>('ConfigModule');
    if (!configModule) {
      throw new Error('ConfigModule not found in module manager');
    }
    this.configHandler = new ConfigHandler(configModule);
  }

  private registerPingHandler(): void {
    this.registerHandler({
      channel: IPC_CHANNELS.PING,
      handler: async (): Promise<string> => {
        return 'pong';
      },
    });
  }

  private registerSystemInfoHandlers(): void {
    this.registerHandler({
      channel: IPC_CHANNELS.SYSTEM_INFO,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.systemInfoHandler.getSystemInfo(event);
      },
    });
  }

  private registerConfigHandlers(): void {
    if (!this.configHandler) {
      getLogger().error('ConfigHandler not initialized');
      return;
    }

    this.registerHandler({
      channel: IPC_CHANNELS.CONFIG_GET,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.configHandler!.getConfig(event);
      },
    });

    this.registerHandler({
      channel: IPC_CHANNELS.CONFIG_UPDATE,
      handler: (event: IpcMainInvokeEvent, updates: unknown): Promise<any> => {
        return this.configHandler!.updateConfig(event, updates);
      },
    });
  }

  private registerLogReportHandler(): void {
    this.registerHandler({
      channel: IPC_CHANNELS.LOG_REPORT,
      handler: (
        event: IpcMainInvokeEvent,
        level: 'info' | 'warn' | 'error',
        message: string,
        meta?: string | Record<string, unknown>,
      ): Promise<void> => {
        return this.logReportHandler.report(event, level, message, meta);
      },
    });
  }

  private registerWindowHandlers(): void {
    this.registerHandler({
      channel: IPC_CHANNELS.WINDOW_MINIMIZE,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.windowHandler.minimizeWindow(event);
      },
    });

    this.registerHandler({
      channel: IPC_CHANNELS.WINDOW_MAXIMIZE,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.windowHandler.maximizeWindow(event);
      },
    });

    this.registerHandler({
      channel: IPC_CHANNELS.WINDOW_CLOSE,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.windowHandler.closeWindow(event);
      },
    });
  }
}
