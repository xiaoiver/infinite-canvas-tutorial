<script setup lang="ts">
import {
  Pen,
  Task,
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

    api.runAtNextTick(() => {
      api.setAppState({
        penbarSelected: Pen.TEXT,
        penbarAll: [Pen.HAND, Pen.SELECT, Pen.TEXT],
      });

      const nodes = [
        {
          id: '1',
          type: 'text',
          content: 'Hello, world!',
          anchorX: 200,
          anchorY: 120,
          fontSize: 48,
          fills: [{ type: 'solid', value: 'black', opacity: 1 }],
          fontFamily: 'system-ui',
        }
      ]

      api.updateNodes(nodes);
      api.selectNodes([nodes[0]]);

      api.record();
    });
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