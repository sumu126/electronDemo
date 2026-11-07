/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError, reportInfo, reportWarning } from './report';

const invoke = vi.fn();

const stubElectronApi = () => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });
};

const removeElectronApi = () => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: undefined,
  });
};

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
  stubElectronApi();
});

afterEach(() => {
  removeElectronApi();
});

describe('report', () => {
  it('按级别上报到 log:report 通道', () => {
    reportInfo('hello', { a: 1 });
    reportWarning('careful');

    expect(invoke).toHaveBeenNthCalledWith(1, 'log:report', 'info', 'hello', { a: 1 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'log:report', 'warn', 'careful', undefined);
  });

  it('错误会被序列化成可传输的对象', () => {
    reportError('failed', new Error('boom'), { module: 'HomeView' });

    expect(invoke).toHaveBeenCalledWith('log:report', 'error', 'failed', {
      module: 'HomeView',
      error: expect.objectContaining({ name: 'Error', message: 'boom' }),
    });
  });

  it('非 Error 抛出物也能上报', () => {
    reportError('failed', 'plain string');

    expect(invoke).toHaveBeenCalledWith('log:report', 'error', 'failed', {
      error: { value: 'plain string' },
    });
  });

  it('没有 electronAPI 时静默降级，不抛错', () => {
    removeElectronApi();

    expect(() => reportError('failed', new Error('boom'))).not.toThrow();
  });

  it('上报失败不会把异常抛回调用方', () => {
    invoke.mockRejectedValue(new Error('channel blocked'));

    expect(() => reportInfo('hello')).not.toThrow();
  });
});
