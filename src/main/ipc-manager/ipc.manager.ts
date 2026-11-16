import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { SystemInfoHandler } from '../ipc/system.handler';
import { WindowHandler } from '../ipc/window.handler';
import { LogReportHandler } from '../ipc/log.handler';
import { IPC_CHANNELS } from '@shared/constants';
import { isTrustedSenderUrl } from '../ipc/sender';
import type { IpcHandlerContribution } from '../ipc/ipc-contribution';
import { ModuleManager } from '../managers/module.manager';

export class IpcManager {
  private ipcMain: IpcMain;
  private handlers: Map<string, IpcHandlerContribution> = new Map();
  private systemInfoHandler: SystemInfoHandler;
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

  public registerHandler(handler: IpcHandlerContribution): void {
    // 通道不允许被覆盖：模块之间互相劫持会静默改变安全边界
    if (this.handlers.has(handler.channel)) {
      throw new Error(`Duplicate IPC channel: ${handler.channel}`);
    }

    this.handlers.set(handler.channel, handler);

    // 注册时把具体通道的签名擦成统一形态，类型校验留在贡献点声明处
    const invoke = handler.handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

    this.ipcMain.handle(handler.channel, (event, ...args) => {
      const senderUrl = event.senderFrame?.url ?? '';
      if (!isTrustedSenderUrl(senderUrl, Boolean(process.defaultApp))) {
        throw new Error(`Blocked IPC call from untrusted sender: ${senderUrl || 'unknown'}`);
      }
      return invoke(event, ...args);
    });
  }

  public setupHandlers(): void {
    // 注册通用IPC处理器
    this.registerPingHandler();

    // 注册系统信息处理器
    this.registerSystemInfoHandlers();

    // 注册窗口操作处理器
    this.registerWindowHandlers();

    // 注册渲染进程日志上报处理器
    this.registerLogReportHandler();

    // 模块自己声明的通道（核心模块），统一走 sender 校验
    this.registerModuleHandlers();
  }

  private registerModuleHandlers(): void {
    for (const contribution of this.moduleManager.collectIpcHandlers()) {
      this.registerHandler(contribution);
    }
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
