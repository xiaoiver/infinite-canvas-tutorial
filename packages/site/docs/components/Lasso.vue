<script setup lang="ts">
import { Pen, type API } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let onReady: ((api: CustomEvent<API>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    const api = e.detail;

    api.setAppState({
      penbarSelected: Pen.LASSO,
      cameraZoom: Math.min(1, canvas.clientWidth / 460),
      penbarAll: [Pen.SELECT, Pen.DRAW_RECT, Pen.LASSO],
    });
    api.updateNodes([
      {
        id: 'lasso-rect-1',
        type: 'rect',
        zIndex: 0,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        fills: [{ type: 'solid', value: '#e0f2ff', opacity: 0.5 }],
        stroke: '#147af3',
        strokeWidth: 1,
      },
      {
        id: 'lasso-polyline',
        type: 'polyline',
        zIndex: 1,
        x: 300,
        y: 100,
        width: 100,
        height: 100,
        points: '0,0 100,100 0,100',
        stroke: '#147af3',
        strokeWidth: 1,
      },
    ]);
  };

  canvas.addEventListener(Event.READY, onReady);
  await ensureExampleWorld();
});

onBeforeUnmount(() => {
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px">
    <ic-spectrum-penbar-lasso slot="penbar-item" />
  </ic-spectrum-canvas>
</template>
