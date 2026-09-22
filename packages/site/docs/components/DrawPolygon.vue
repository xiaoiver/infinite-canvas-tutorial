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
      penbarSelected: Pen.DRAW_TRIANGLE,
      penbarAll: [Pen.SELECT, Pen.DRAW_TRIANGLE, Pen.DRAW_PENTAGON, Pen.DRAW_HEXAGON],
    });
    api.updateNode({
      id: 'draw-rect-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: '#e0f2ff', opacity: 0.5 }],
      stroke: '#147af3',
      strokeWidth: 1,
    });
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