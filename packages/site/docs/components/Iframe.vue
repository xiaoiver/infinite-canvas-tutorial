<script setup lang="ts">
import {
  Pen,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      cameraZoom: 0.5,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.HAND, Pen.SELECT],
      penbarVisible: true,
      taskbarVisible: false,
    });

    const node = {
      id: 'embed-1',
      type: 'embed',
      url: 'https://www.youtube.com/watch?v=37fvFffAmf8',
      x: 100,
      y: 100,
      width: 800,
      height: 450,
      lockAspectRatio: true,
    };
    api.updateNode(node);

    api.selectNodes([node]);
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>