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

  onReady = (e) => {
    api = e.detail;

    const node = {
      type: 'rect',
      id: '0',
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      stroke: 'black',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    };

    api.setAppState({
      penbarSelected: Pen.SELECT,
      taskbarSelected: [Task.SHOW_LAYERS_PANEL],
    });

    api.updateNodes([node]);
    api.record();

    api.updateNode(node, {
      fills: [{ type: 'solid', value: 'blue', opacity: 1 }],
    });
    api.record();
  };
  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(() => {
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
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
  </div>
</template>