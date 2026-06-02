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
      penbarSelected: Pen.DRAW_ARROW,
      penbarAll: [Pen.SELECT, Pen.DRAW_ARROW],
      penbarDrawArrow: {
        stroke: '#147af3',
        strokeWidth: 4,
        markerStart: 'none',
        markerEnd: 'line',
        markerFactor: 3,
      },
    });
    api.updateNodes([{
      id: 'draw-arrow-1',
      type: 'polyline',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      points: '0,0 100,0 100,100',
      stroke: '#147af3',
      strokeWidth: 4,
      markerStart: 'line',
      markerEnd: 'line',
    },
    {
      id: 'draw-arrow-2',
      type: 'polyline',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      points: '0,0 100,0 100,100 0,100',
      stroke: '#147af3',
      strokeWidth: 4,
      markerStart: 'triangle',
      markerEnd: 'diamond',
    }]);
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