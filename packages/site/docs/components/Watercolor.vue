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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    api.updateNodes([
      {
        type: 'rough-rect',
        id: 'watercolor-rect',
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        roughFillStyle: 'watercolor',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      },
      {
        type: 'rough-ellipse',
        id: 'watercolor-ellipse',
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        roughFillStyle: 'watercolor',
        x: 200,
        y: 50,
        width: 100,
        height: 100,
      },
      {
        type: 'rough-path',
        id: 'watercolor-path',
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        roughFillStyle: 'watercolor',
        d: 'M 400 100 L 500 200 L 600 100 Z',
        stroke: 'red',
        strokeWidth: 2,
      }
    ]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px">
  </ic-spectrum-canvas>
</template>