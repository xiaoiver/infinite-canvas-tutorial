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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
    });

    const node1 = {
      id: 'transformer-rect-rotated-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      stroke: 'black',
      strokeWidth: 10,
      rotation: Math.PI / 4,
    };

    const node2 = {
      id: 'transformer-ellipse-rotated-1',
      type: 'ellipse',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      stroke: 'black',
      strokeWidth: 10,
      rotation: Math.PI / 4,
    };

    api.updateNodes([
      node1, node2
    ]);
    api.selectNodes([node1]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>