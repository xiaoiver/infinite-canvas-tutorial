<script setup lang="ts">
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { buildBlendModeDemoNodes } from '../lib/blend-mode-demo-nodes';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let onReady: ((e: CustomEvent) => void) | undefined;
let bootstrapped = false;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    const api = e.detail;

    api.setAppState({
      cameraZoom: 1,
      penbarSelected: Pen.HAND,
      penbarAll: [Pen.HAND, Pen.SELECT],
      penbarVisible: false,
      taskbarVisible: false,
    });

    api.updateNodes(buildBlendModeDemoNodes());
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onUnmounted(() => {
  bootstrapped = false;
  const canvas = wrapper.value;
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 520px" />
</template>
