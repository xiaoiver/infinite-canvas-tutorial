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

    api.runAtNextTick(() => {
      api.updateNodes([
        {
          id: 'vello-dropshadow-1',
          type: 'rect',
          x: 200,
          y: 20,
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
          width: 100,
          height: 100,
          filter: 'drop-shadow(10px 10px 5px black)',
          cornerRadius: 10,
          zIndex: 0,
        }
      ]);
    });
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

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 200px"></ic-spectrum-canvas>
</template>