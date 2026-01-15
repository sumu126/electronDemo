import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { SystemInfoHandler } from './system.handler';
import { ConfigHandler } from './config.handler';
import { FileHandler } from './file.handler';
import { WindowHandler } from './window.handler';
import { IPC_CHANNELS } from '@shared/constants';
import { ModuleManager } from '../managers/module.manager';
import { ConfigModule } from '../modules/config.module';

export interface IpcHandler {
  channel: string;
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
}

export class IpcManager {
  private ipcMain: IpcMain;
  private handlers: Map<string, IpcHandler> = new Map();
  private systemInfoHandler: SystemInfoHandler;
  private configHandler: ConfigHandler | null = null;
  private fileHandler: FileHandler;
  private windowHandler: WindowHandler;
  private moduleManager: ModuleManager;

  constructor(ipcMain: IpcMain, moduleManager: ModuleManager) {
    this.ipcMain = ipcMain;
    this.moduleManager = moduleManager;
    
    // 初始化处理器
    this.systemInfoHandler = new SystemInfoHandler();
    this.fileHandler = new FileHandler();
    this.windowHandler = new WindowHandler();
  }

  public registerHandler(handler: IpcHandler): void {
    this.handlers.set(handler.channel, handler);
    this.ipcMain.handle(handler.channel, handler.handler);
  }

  public unregisterHandler(channel: string): void {
    if (this.handlers.has(channel)) {
      this.ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
    }
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
    
    // 注册文件操作处理器
    this.registerFileHandlers();
    
    // 注册窗口操作处理器
    this.registerWindowHandlers();
  }

  private initializeConfigHandler(): void {
    // 获取配置模块实例
    const configModule = this.moduleManager.getModule('ConfigModule') as ConfigModule;
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
      console.error('ConfigHandler not initialized');
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
      handler: (event: IpcMainInvokeEvent, updates: any): Promise<any> => {
        return this.configHandler!.updateConfig(event, updates);
      },
    });
  }

  private registerFileHandlers(): void {
    this.registerHandler({
      channel: IPC_CHANNELS.FILE_READ,
      handler: (event: IpcMainInvokeEvent, filePath: string): Promise<any> => {
        return this.fileHandler.readFile(event, filePath);
      },
    });
    
    this.registerHandler({
      channel: IPC_CHANNELS.FILE_WRITE,
      handler: (event: IpcMainInvokeEvent, filePath: string, data: string): Promise<any> => {
        return this.fileHandler.writeFile(event, filePath, data);
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

  public getHandler(channel: string): IpcHandler | undefined {
    return this.handlers.get(channel);
  }

  public getAllChannels(): string[] {
    return Array.from(this.handlers.keys());
  }
}