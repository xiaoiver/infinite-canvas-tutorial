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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    api.updateNodes([
      {
        type: 'rough-rect',
        id: 'watercolor-rect',
        fill: 'red',
        roughFillStyle: 'watercolor',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      },
      {
        type: 'rough-ellipse',
        id: 'watercolor-ellipse',
        fill: 'red',
        roughFillStyle: 'watercolor',
        x: 200,
        y: 50,
        width: 100,
        height: 100,
      },
      {
        type: 'rough-path',
        id: 'watercolor-path',
        fill: 'red',
        roughFillStyle: 'watercolor',
        d: 'M 400 100 L 500 200 L 600 100 Z',
        stroke: 'red',
        strokeWidth: 2,
      }
    ]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px">
  </ic-spectrum-canvas>
</template>