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
      penbarAll: [Pen.HAND, Pen.SELECT],
    });

    const image = {
      id: 'pixelate-1',
      type: 'rect',
      fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
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
      fill: 'linear-gradient(to right, red, blue)',
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px" renderer="webgl"></ic-spectrum-canvas>
</template>