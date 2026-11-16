<template>
  <div class="config-panel">
    <h3>{{ t.config.title }}</h3>
    <p class="config-hint">{{ t.config.envHint }}</p>

    <div v-if="loading" class="config-hint">{{ t.config.loading }}</div>
    <div v-if="error" class="error-message" role="alert" aria-live="polite">
      {{ t.config.loadFailed }}
    </div>

    <div class="config-section">
      <h4>{{ t.config.appearance }}</h4>
      <div class="form-group">
        <label>{{ t.config.theme }}</label>
        <div class="readonly-value">{{ themeLabel }}</div>
      </div>
      <div class="form-group">
        <label>{{ t.config.language }}</label>
        <div class="readonly-value">{{ config.language }}</div>
      </div>
    </div>

    <div class="config-section">
      <h4>{{ t.config.features }}</h4>
      <div class="form-group">
        <label>{{ t.config.developerTools }}</label>
        <div class="readonly-value">
          {{ config.features.developerTools ? t.config.enabled : t.config.disabled }}
        </div>
      </div>
    </div>

    <div class="config-section">
      <h4>{{ t.config.security }}</h4>
      <div class="form-group">
        <label>{{ t.config.sandbox }}</label>
        <div class="readonly-value">
          {{ config.security.sandboxEnabled ? t.config.enabled : t.config.disabled }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConfig } from '../composables/useConfig';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
const { config, loading, error } = useConfig();

const themeLabel = computed(() => {
  const labels = {
    light: t.value.config.themeLight,
    dark: t.value.config.themeDark,
    auto: t.value.config.themeAuto,
  };

  return labels[config.value.theme];
});
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

.readonly-value {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-surface-muted, transparent);
  color: var(--color-text);
  font-size: 14px;
}

.config-hint {
  margin: 0 0 15px;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
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
