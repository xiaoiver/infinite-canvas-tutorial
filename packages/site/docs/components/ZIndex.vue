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

  const nodes = [
    {
      id: '1',
      type: 'rect',
      x: 100,
      y: 20,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      zIndex: 1,
    },
    {
      id: '2',
      type: 'rect',
      x: 150,
      y: 70,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'blue', opacity: 1 }],
      zIndex: 2,
    },
    {
      id: '3',
      type: 'rect',
      x: 200,
      y: 120,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'green', opacity: 1 }],
      zIndex: 3,
    },
  ];

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarVisible: false,
      taskbarVisible: false,
    });

    api.updateNodes(nodes);
    api.record();

    api.selectNodes([nodes[0]]);
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
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
  </div>
</template>