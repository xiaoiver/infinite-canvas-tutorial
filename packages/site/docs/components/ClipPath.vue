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

    const parent = {
      id: 'parent-1',
      type: 'ellipse',
      clipMode: 'clip',
      x: 200,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
    };
    const child = {
      id: 'rect-1',
      type: 'rect',
      parentId: 'parent-1',
      x: -50,
      y: -50,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
    };

    api.updateNodes([
      parent, child,
    ]);
    api.selectNodes([child]);
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