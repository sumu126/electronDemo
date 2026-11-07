<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" role="presentation" @click="handleOverlayClick">
      <div
        ref="containerRef"
        class="modal-container"
        :class="{ centered }"
        :style="width ? { width } : undefined"
        role="dialog"
        aria-modal="true"
        :aria-label="title || '对话框'"
        tabindex="-1"
        @click.stop
      >
        <div class="modal-header">
          <slot name="header">
            <h3>{{ title }}</h3>
          </slot>
          <button
            v-if="closable"
            class="modal-close-btn"
            type="button"
            aria-label="关闭"
            @click="closeModal"
          >
            &times;
          </button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div class="modal-footer" v-if="$slots.footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

interface Props {
  visible: boolean;
  title?: string;
  centered?: boolean;
  closable?: boolean;
  maskClosable?: boolean;
  width?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  centered: true,
  closable: true,
  maskClosable: true,
  width: '',
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  close: [];
}>();

const containerRef = ref<HTMLElement | null>(null);
// 关闭后把焦点还给打开弹窗的元素，避免键盘用户丢失位置
let previouslyFocused: HTMLElement | null = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const focusableElements = (): HTMLElement[] =>
  Array.from(containerRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
    (element) => element.offsetParent !== null,
  );

const handleOverlayClick = () => {
  if (props.maskClosable) {
    closeModal();
  }
};

const closeModal = () => {
  if (props.closable) {
    emit('update:visible', false);
    emit('close');
  }
};

// ESC 关闭 + Tab 焦点陷阱：弹窗打开时焦点不应跑到背后的页面上
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closable) {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const elements = focusableElements();

  if (elements.length === 0) {
    event.preventDefault();
    containerRef.value?.focus();
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const release = () => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
  previouslyFocused?.focus();
  previouslyFocused = null;
};

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      release();
      return;
    }

    previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';

    await nextTick();
    (focusableElements()[0] ?? containerRef.value)?.focus();
  },
  { immediate: true },
);

onBeforeUnmount(release);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease;
}

.centered {
  margin: auto;
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-btn:hover {
  color: #333;
  background-color: #f5f5f5;
  border-radius: 50%;
}

.modal-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
