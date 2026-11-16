/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig } from '@shared/config/defaults';
import ConfigPanel from './ConfigPanel.vue';

const invoke = vi.fn();

const stubElectronApi = () => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });
};

const mountPanel = (config = createDefaultConfig()) => {
  invoke.mockImplementation(async (channel: string) =>
    channel === 'config:get' ? config : undefined,
  );

  return mount(ConfigPanel);
};

beforeEach(() => {
  setActivePinia(createPinia());
  invoke.mockReset();
  stubElectronApi();
});

describe('ConfigPanel', () => {
  it('只读展示 .env 中的主题、语言与沙箱状态', async () => {
    const wrapper = mountPanel(
      createDefaultConfig({
        theme: 'dark',
        language: 'en-US',
        security: { sandboxEnabled: false },
      }),
    );
    await flushPromises();

    expect(wrapper.text()).toContain('Application settings');
    expect(wrapper.text()).toContain('Dark');
    expect(wrapper.text()).toContain('en-US');
    expect(wrapper.text()).toContain('Disabled');
    expect(wrapper.text()).toContain('project .env file');

    expect(wrapper.findAll('select')).toHaveLength(0);
    expect(wrapper.find('.btn-primary').exists()).toBe(false);

    wrapper.unmount();
  });

  it('不提供运行时写配置的入口', async () => {
    const wrapper = mountPanel(createDefaultConfig({ language: 'zh-CN' }));
    await flushPromises();

    expect(invoke).toHaveBeenCalledWith('config:get');
    expect(invoke).not.toHaveBeenCalledWith('config:update', expect.anything());

    wrapper.unmount();
  });
});
