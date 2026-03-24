<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';

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

    const node1 = {
      id: 'transformer-line-1',
      type: 'line',
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100,
      stroke: 'black',
      strokeWidth: 10,
    };

    api.updateNodes([
      node1,
    ]);
    api.selectNodes([node1]);
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin, YogaPlugin).run();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>