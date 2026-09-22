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
      layersCropping: ['parent-1'],
    });

    const parent = {
      id: 'parent-1',
      type: 'rect',
      clipMode: 'clip',
      x: 100,
      y: 50,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'none', opacity: 1 }],
    };
    const child = {
      id: 'rect-1',
      type: 'rect',
      parentId: 'parent-1',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: [{ type: 'image', value: '/canvas.png', opacity: 1 }],
      locked: true,
      lockAspectRatio: true,
    };

    api.updateNodes([
      parent, child,
    ]);
    api.selectNodes([parent]);
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