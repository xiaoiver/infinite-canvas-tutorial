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
      penbarAll: [Pen.HAND, Pen.SELECT],
    });

    const image = {
      id: 'pixelate-1',
      type: 'rect',
      fills: [{ type: 'image', value: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg', opacity: 1 }],
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      lockAspectRatio: true,
      filter: 'pixelate(12px)',
    };

    const image2 = {
      id: 'pixelate-2',
      type: 'rect',
      fills: [{ type: 'gradient', value: 'linear-gradient(to right, red, blue)', opacity: 1 }],
      x: 300,
      y: 50,
      width: 200,
      height: 200,
      lockAspectRatio: true,
      filter: 'noise(0.2) pixelate(6px) ',
    };

    api.updateNodes([image, image2]);
    api.selectNodes([image]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px" renderer="webgl"></ic-spectrum-canvas>
</template>