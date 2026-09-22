<script setup lang="ts">
import {
  Pen,
  RectSerializedNode,
  Task,
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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.DRAW_RECT],
      taskbarVisible: true,
      taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    });

    const node: RectSerializedNode = {
      id: 'lama-1',
      type: 'rect',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      fills: [{ type: 'image', value: 'https://v3b.fal.media/files/b/0a86d421/6xSMYtyW-fm2ciM6dHEgB.png', opacity: 1 }],
      zIndex: 0,
    };

    api.updateNode(node);
    api.selectNodes([node]);
    api.record();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
</template>
