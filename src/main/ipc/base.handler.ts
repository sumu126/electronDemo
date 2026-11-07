import { IpcResponse } from '@shared/types';

export abstract class BaseIpcHandler {
  protected async handleAsync<T>(operation: () => Promise<T>): Promise<IpcResponse<T>> {
    try {
      const result = await operation();
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
}
