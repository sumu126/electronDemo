/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal.vue';

const stubElectronApi = () => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke: vi.fn(async () => undefined) },
  });
};

const mountModal = (props: Record<string, unknown> = {}) =>
  mount(Modal, {
    props: { visible: true, title: '设置', ...props },
    slots: { default: '<p class="body-text">内容</p>' },
    // Teleport 到 body 会让查询变麻烦，测试里就地渲染
    global: { stubs: { teleport: true } },
  });

beforeEach(() => {
  setActivePinia(createPinia());
  stubElectronApi();
});

describe('Modal', () => {
  it('渲染对话框语义与插槽内容', () => {
    const wrapper = mountModal();

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-label')).toBe('设置');
    expect(wrapper.get('.body-text').text()).toBe('内容');

    wrapper.unmount();
  });

  it('隐藏时不渲染遮罩', () => {
    const wrapper = mountModal({ visible: false });

    expect(wrapper.find('.modal-overlay').exists()).toBe(false);

    wrapper.unmount();
  });

  it('ESC 关闭并同步 visible', async () => {
    const wrapper = mountModal();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('点击遮罩关闭，maskClosable=false 时不关闭', async () => {
    const closable = mountModal();
    await closable.get('.modal-overlay').trigger('click');
    expect(closable.emitted('close')).toHaveLength(1);
    closable.unmount();

    const locked = mountModal({ maskClosable: false });
    await locked.get('.modal-overlay').trigger('click');
    expect(locked.emitted('close')).toBeUndefined();
    locked.unmount();
  });

  it('closable=false 时不渲染关闭按钮，ESC 也不关闭', async () => {
    const wrapper = mountModal({ closable: false });

    expect(wrapper.find('.modal-close-btn').exists()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:visible')).toBeUndefined();

    wrapper.unmount();
  });

  it('打开时锁定 body 滚动，关闭后恢复', async () => {
    const wrapper = mountModal();
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.setProps({ visible: false });
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
  });
});
