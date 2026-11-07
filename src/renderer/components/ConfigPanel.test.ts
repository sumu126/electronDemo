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
  it('从配置回显主题与语言', async () => {
    const wrapper = mountPanel(createDefaultConfig({ theme: 'dark', language: 'en-US' }));
    await flushPromises();

    const [themeSelect, languageSelect] = wrapper.findAll('select');
    expect((themeSelect.element as HTMLSelectElement).value).toBe('dark');
    expect((languageSelect.element as HTMLSelectElement).value).toBe('en-US');

    wrapper.unmount();
  });

  it('语言切换后文案跟随配置变化', async () => {
    const wrapper = mountPanel(createDefaultConfig({ language: 'en-US' }));
    await flushPromises();

    expect(wrapper.text()).toContain('Application settings');
    expect(wrapper.text()).toContain('Follow system');

    wrapper.unmount();
  });

  it('保存时把本地编辑通过 config:update 提交', async () => {
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.findAll('select')[0].setValue('light');
    await wrapper.get('.btn-primary').trigger('click');
    await flushPromises();

    expect(invoke).toHaveBeenCalledWith(
      'config:update',
      expect.objectContaining({ theme: 'light' }),
    );

    wrapper.unmount();
  });
});
