<script setup lang="ts">
import { Pen, type API } from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { buildBlendModeDemoNodes } from '../lib/blend-mode-demo-nodes';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let onReady: ((e: CustomEvent) => void) | undefined;
let bootstrapped = false;
let resizeObserver: ResizeObserver | undefined;
const error = ref('');

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    const api = e.detail as API;
    const fit = () => Math.min(1, canvas.clientWidth / 780);

    try {
      await api.edit(() => {
        api.setAppState({
          cameraZoom: fit(),
          penbarSelected: Pen.HAND,
          penbarAll: [Pen.HAND, Pen.SELECT],
          penbarVisible: false,
          taskbarVisible: false,
        });

        api.updateNodes(buildBlendModeDemoNodes());
      });
      if (!canvas.isConnected) return;
      resizeObserver = new ResizeObserver(() =>
        api.setAppState({ cameraZoom: fit() }),
      );
      resizeObserver.observe(canvas);
    } catch (cause) {
      error.value = String(cause);
    }
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);
  try {
    await ensureExampleWorld();
  } catch (cause) {
    error.value = String(cause);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  bootstrapped = false;
  const canvas = wrapper.value;
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
});
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 520px" />
</template>
