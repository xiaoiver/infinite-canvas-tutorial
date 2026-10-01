<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{ locale: 'en' | 'zh' }>();
const frame = ref<HTMLIFrameElement | null>(null);
const height = ref(900);
const src = withBase(
  props.locale === 'zh'
    ? '/zh/example/react-playground'
    : '/example/react-playground',
);
const resize = (event: MessageEvent) => {
  if (
    event.origin !== window.location.origin ||
    event.source !== frame.value?.contentWindow
  )
    return;
  if (
    event.data?.type !== 'ic-react-demo-resize' ||
    !Number.isFinite(event.data.height)
  )
    return;
  // VitePress uses border-box sizing; include the frame's two 1px borders.
  height.value = Math.min(1800, Math.max(300, event.data.height + 2));
};
onMounted(() => window.addEventListener('message', resize));
onBeforeUnmount(() => window.removeEventListener('message', resize));
</script>

<template>
  <iframe
    ref="frame"
    :src="src"
    :title="
      locale === 'zh'
        ? 'React 画布交互示例'
        : 'Interactive React canvas example'
    "
    :style="{ height: `${height}px` }"
    class="react-canvas-example"
    loading="lazy"
  ></iframe>
</template>

<style scoped>
.react-canvas-example {
  display: block;
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}
</style>
