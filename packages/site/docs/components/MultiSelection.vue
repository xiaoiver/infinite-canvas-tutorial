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
      penbarAll: [Pen.SELECT],
    });

    const node1 = {
      id: '1',
      type: 'rect',
      x: 150,
      y: 30,
      width: 200,
      height: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
    };
    const node2 = {
      id: '2',
      type: 'rect',
      x: 250,
      y: 130,
      width: 200,
      height: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
    };

    api.updateNodes([node1, node2]);
    api.selectNodes([node1, node2]);
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