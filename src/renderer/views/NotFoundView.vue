<template>
  <div class="not-found">
    <p class="code">404</p>
    <h1>{{ t.notFound.title }}</h1>
    <p class="description">{{ t.notFound.description }}</p>
    <RouterLink class="back-link" to="/">{{ t.notFound.backHome }}</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  background: var(--color-bg);
  color: var(--color-text);
}

.code {
  margin: 0;
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-primary);
}

h1 {
  margin: 8px 0 0;
  font-size: 22px;
}

.description {
  margin: 0;
  color: var(--color-text-muted);
}

.back-link {
  margin-top: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  background-color: var(--color-primary);
  color: #fff;
  text-decoration: none;
}

.back-link:hover {
  background-color: var(--color-primary-hover);
}
</style>
