import type { IpcHandlerContribution } from '../ipc/ipc-contribution';

export interface Module {
  name: string;
  version?: string;
  description?: string;
  init(): Promise<void>;
  destroy?(): Promise<void>;
  /** 该模块提供的 IPC 通道；只有核心模块会被 ModuleManager 收集 */
  ipcHandlers?(): IpcHandlerContribution[];
}
