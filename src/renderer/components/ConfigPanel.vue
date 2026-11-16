<template>
  <div class="config-panel">
    <h3>{{ t.config.title }}</h3>

    <div class="config-section">
      <h4>{{ t.config.appearance }}</h4>
      <div class="form-group">
        <label for="config-theme">{{ t.config.theme }}:</label>
        <select
          id="config-theme"
          :value="localConfig.theme"
          class="form-control"
          @change="handleThemeChange"
        >
          <option value="light">{{ t.config.themeLight }}</option>
          <option value="dark">{{ t.config.themeDark }}</option>
          <option value="auto">{{ t.config.themeAuto }}</option>
        </select>
      </div>

      <div class="form-group">
        <label for="config-language">{{ t.config.language }}:</label>
        <select
          id="config-language"
          :value="localConfig.language"
          class="form-control"
          @change="handleLanguageChange"
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
    </div>

    <div class="config-section">
      <h4>{{ t.config.features }}</h4>
      <div class="form-group checkbox-group">
        <label class="checkbox-label" for="config-developer-tools">
          <input
            id="config-developer-tools"
            type="checkbox"
            :checked="localConfig.features.developerTools"
            @change="
              handleFeatureToggle('developerTools', ($event.target as HTMLInputElement).checked)
            "
          />
          {{ t.config.developerTools }}
        </label>
      </div>
    </div>

    <div class="config-actions">
      <button class="btn btn-primary" :disabled="loading" @click="saveConfig">
        {{ loading ? t.config.saving : t.config.save }}
      </button>
      <button class="btn btn-secondary" @click="resetConfig">{{ t.config.reset }}</button>
    </div>

    <div v-if="error" class="error-message" role="alert" aria-live="polite">
      {{ t.config.saveFailed }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useConfig } from '../composables/useConfig';
import { useI18n } from '../composables/useI18n';
import { AppConfig } from '@shared/types';

const { t } = useI18n();
const { config, loading, error, updateConfig } = useConfig();

// 本地配置副本，用于编辑
const localConfig = ref<AppConfig>({ ...config.value });

// 监听远程配置变化
watch(
  () => config.value,
  (newConfig) => {
    localConfig.value = { ...newConfig };
  },
  { deep: true },
);

// 处理主题变化
const handleThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  localConfig.value = {
    ...localConfig.value,
    theme: target.value as 'light' | 'dark' | 'auto',
  };
};

// 处理语言变化
const handleLanguageChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  localConfig.value = {
    ...localConfig.value,
    language: target.value as AppConfig['language'],
  };
};

// 处理功能开关
const handleFeatureToggle = (feature: keyof AppConfig['features'], checked: boolean) => {
  localConfig.value = {
    ...localConfig.value,
    features: {
      ...localConfig.value.features,
      [feature]: checked,
    },
  };
};

// 保存配置
const saveConfig = async () => {
  await updateConfig(localConfig.value);
};

// 重置配置
const resetConfig = () => {
  localConfig.value = { ...config.value };
};
</script>

<style scoped>
.config-panel {
  background: var(--color-surface);
  color: var(--color-text);
  padding: 20px;
  border-radius: 8px;
  box-shadow: var(--shadow-card);
}

.config-section {
  margin-bottom: 25px;
}

.config-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: var(--color-text-muted);
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--color-surface);
  color: var(--color-text);
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 8px;
}

.config-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: white;
}

.btn-secondary:hover {
  background-color: var(--color-secondary-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background-color: var(--color-danger-soft);
  color: var(--color-danger-text);
  border-radius: 4px;
  border: 1px solid var(--color-danger);
}
</style>
