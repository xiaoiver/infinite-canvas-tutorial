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
      id: 'transformer-path-1',
      type: 'path',
      d: 'M 100 100 C 200 100, 200 200, 100 200',
      stroke: 'red',
      strokeWidth: 10,
      zIndex: 1,
    };

    const node2 = {
      id: 'transformer-path-2',
      type: 'path',
      d: 'M 200 200 Q 200 100, 300 100',
      stroke: 'blue',
      strokeWidth: 10,
      zIndex: 2,
    };

    // 三段连续的贝塞尔曲线
    const node3 = {
      id: 'transformer-path-3',
      type: 'path',
      d: 'M 400 100 C 500 100, 500 200, 400 200 Q 300 200, 300 100',
      stroke: 'green',
      strokeWidth: 10,
      zIndex: 3,
    }

    api.updateNodes([
      node1,
      node2,
      node3,
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