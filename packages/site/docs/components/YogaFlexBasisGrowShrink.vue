<script setup lang="ts">
import {
  Pen,
  TRANSFORMER_MASK_FILL_COLOR,
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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    const parent = {
      id: 'yoga-flex-basis-grow-shrink-parent',
      type: 'rect',
      x: 100,
      y: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
      display: 'flex',
      width: 200,
      height: 250,
      padding: 10,
      zIndex: 0,
    } as const;

    const child = {
      id: 'yoga-flex-basis-grow-shrink-child1',
      parentId: 'yoga-flex-basis-grow-shrink-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      flexGrow: 0.25,
      margin: 5,
      zIndex: 1,
    } as const;

    const child2 = {
      id: 'yoga-flex-basis-grow-shrink-child2',
      parentId: 'yoga-flex-basis-grow-shrink-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      flexGrow: 0.75,
      margin: 5,
      zIndex: 1,
    } as const;

    api.updateNodes([parent, child, child2]);
    api.selectNodes([parent]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.6, "cameraX": -200, "cameraY": 50}'>
  </ic-spectrum-canvas>
</template>