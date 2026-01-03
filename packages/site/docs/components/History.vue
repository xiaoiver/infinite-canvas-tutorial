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

  onReady = (e) => {
    api = e.detail;

    const node = {
      type: 'rect',
      id: '0',
      fill: 'red',
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
      fill: 'blue',
    });
    api.record();
  };
  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin).run();
  }
});

onUnmounted(() => {
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
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
  </div>
</template>