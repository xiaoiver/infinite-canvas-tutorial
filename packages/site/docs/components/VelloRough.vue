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
let onReadyFired = false;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    if (onReadyFired) return;
    onReadyFired = true;
    api = e.detail;

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    const path = {
      id: 'vello-rough-3',
      type: 'rough-path',
      d: 'M 100 120 L 200 200 L 300 100 Z',
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      stroke: 'black',
      roughFillStyle: 'dots',
      roughHachureGap: 10,
      zIndex: 0,
    } as const;

    const polyline = {
      id: 'vello-rough-6',
      type: 'rough-polyline',
      points: '200,220 200,300 300,200',
      stroke: 'black',
      strokeWidth: 10,
      zIndex: 0,
    } as const;

    api.updateNodes([
      {
        id: 'vello-rough-1',
        type: 'rough-rect',
        x: 200,
        y: 20,
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'hachure',
        zIndex: 0,
      },
      {
        id: 'vello-rough-2',
        type: 'rough-ellipse',
        x: 300,
        y: 20,
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'hachure',
        roughHachureGap: 10,
        zIndex: 0,
      },
      path,
      {
        id: 'vello-rough-4',
        type: 'rough-rect',
        x: 400,
        y: 20,
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'zigzag',
        roughHachureGap: 20,
        zIndex: 0,
      },
      {
        id: 'vello-rough-5',
        type: 'rough-rect',
        x: 500,
        y: 20,
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'cross-hatch',
        roughHachureGap: 20,
        zIndex: 0,
      },
      polyline,
    ]);
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld([], {
    vello: true,
    velloFonts: ['/fonts/NotoSans-Regular.ttf', '/fonts/Gaegu-Regular.ttf'],
  });
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  onReadyFired = false;
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
</template>