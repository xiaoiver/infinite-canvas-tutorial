<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import type { mountPlayground, PlaygroundOptions } from './react/playground';

const props = defineProps<{ locale: PlaygroundOptions['locale'] }>();
const { isDark } = useData();
const host = ref<HTMLElement | null>(null);
const error = ref(false);
const loading = ref(true);
let cancelled = false;
let playground: ReturnType<typeof mountPlayground> | undefined;
let observer: ResizeObserver | undefined;
const options = (): PlaygroundOptions => ({
  locale: props.locale,
  theme: isDark.value ? 'dark' : 'light',
});

onMounted(async () => {
  try {
    const { mountPlayground } = await import('./react/playground');
    if (cancelled || !host.value) return;
    playground = mountPlayground(host.value, options());
    loading.value = false;
    observer = new ResizeObserver(() => {
      if (window.parent === window || !host.value) return;
      window.parent.postMessage(
        {
          type: 'ic-react-demo-resize',
          height: Math.ceil(host.value.getBoundingClientRect().height) + 32,
        },
        window.location.origin,
      );
    });
    observer.observe(host.value);
  } catch {
    if (!cancelled) error.value = true;
    loading.value = false;
  }
});

watch(
  () => [props.locale, isDark.value],
  () => playground?.update(options()),
);
onBeforeUnmount(() => {
  cancelled = true;
  observer?.disconnect();
  playground?.destroy();
});
</script>

<template>
  <div class="react-demo-host">
    <p v-if="error" role="alert">
      {{
        locale === 'zh'
          ? '示例未能加载，请刷新后重试。'
          : 'The demo could not load. Refresh to try again.'
      }}
    </p>
    <p v-else-if="loading" role="status">
      {{ locale === 'zh' ? '正在加载示例…' : 'Loading demo…' }}
    </p>
    <div ref="host"></div>
  </div>
</template>

<style>
.react-demo-host {
  padding: 16px;
}
.react-demo {
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  font-size: 14px;
}
.react-demo h1 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}
.react-demo-hint {
  margin: 0 0 16px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
.react-demo-settings,
.react-demo-actions,
.react-demo-status,
.react-demo-zoom,
.react-demo .document-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.react-demo .document-controls {
  margin-top: 12px;
}
.react-demo .document-controls p {
  margin: 0;
  width: 100%;
}
.react-demo-settings {
  justify-content: space-between;
  margin-bottom: 16px;
}
.react-demo-settings label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.react-demo-settings input {
  accent-color: var(--vp-c-brand-1);
}
.react-demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 16px;
}
.react-demo-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
}
.react-demo-panel h2 {
  padding: 12px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.react-demo-canvas {
  width: 100%;
  height: 270px;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}
.react-demo-controls {
  padding: 12px;
}
.react-demo-status {
  margin-top: 12px;
  justify-content: space-between;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.react-demo button {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font: inherit;
  line-height: 1.4;
}
.react-demo button:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.react-demo button:focus-visible,
.react-demo input:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.react-demo button:disabled {
  opacity: 0.45;
  cursor: default;
}
.react-demo-zoom {
  gap: 4px;
}
.react-demo-zoom button {
  min-width: 30px;
  padding: 4px 6px;
}
.react-demo-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  margin: 0;
  pointer-events: none;
}
</style>
