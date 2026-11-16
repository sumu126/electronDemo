import type { IpcMainInvokeEvent } from 'electron';
import type { IpcArgs, IpcChannel, IpcResult } from '@shared/types';

/**
 * 模块对 IPC 的贡献：只声明自己提供哪些通道，注册与 sender 校验由 IpcManager 统一负责。
 *
 * handler 的签名从 IpcInvokeMap 推导，通道名、实参元组与返回值同时受类型约束。
 * 注意：类型只约束调用方，运行时入参仍不可信，需要校验的 handler 照旧收 unknown 再自行校验。
 */
export type IpcHandlerFor<K extends IpcChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcArgs<K>
) => IpcResult<K> | Promise<IpcResult<K>>;

export type IpcHandlerContribution = {
  [K in IpcChannel]: { channel: K; handler: IpcHandlerFor<K> };
}[IpcChannel];
