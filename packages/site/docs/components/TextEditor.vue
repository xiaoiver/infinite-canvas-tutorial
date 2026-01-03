<script setup lang="ts">
import {
  App,
  Pen,
  Task,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';


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
          fill: 'black',
          fontFamily: 'system-ui',
        }
      ]

      api.updateNodes(nodes);
      api.selectNodes([nodes[0]]);

      api.record();
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin).run();
  }
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
});
</script>

<template>
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
  </div>
</template>