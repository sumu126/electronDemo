/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import AppErrorBoundary from './AppErrorBoundary.vue';

const Broken = defineComponent({
  name: 'Broken',
  setup() {
    throw new Error('boom');
  },
  template: '<div>不该渲染</div>',
});

const Healthy = defineComponent({
  name: 'Healthy',
  template: '<div class="healthy">正常内容</div>',
});

beforeEach(() => {
  setActivePinia(createPinia());
  // Vue 会把捕获到的错误打到 console，测试里静音
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('AppErrorBoundary', () => {
  it('子组件正常时直接渲染插槽', () => {
    const wrapper = mount(AppErrorBoundary, { slots: { default: Healthy } });

    expect(wrapper.get('.healthy').text()).toBe('正常内容');
    expect(wrapper.find('.error-boundary').exists()).toBe(false);
  });

  it('子组件抛错时展示兜底界面与错误信息', async () => {
    const wrapper = mount(AppErrorBoundary, { slots: { default: Broken } });

    // onErrorCaptured 里改的状态要到下一个 tick 才反映到 DOM
    await nextTick();
    await flushPromises();

    expect(wrapper.find('.healthy').exists()).toBe(false);
    expect(wrapper.find('.error-boundary').exists()).toBe(true);
    expect(wrapper.text()).toContain('页面出错了');
    expect(wrapper.text()).toContain('boom');
  });
});
