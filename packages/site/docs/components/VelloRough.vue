<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RendererPlugin,
  DefaultRendererPlugin,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { InitVello, VelloPipeline, registerFont } from '@infinite-canvas-tutorial/vello';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;
let onReadyFired = false;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    if (onReadyFired) return;
    onReadyFired = true;
    api = e.detail;

    api.setAppState({
        penbarSelected: Pen.SELECT,
        penbarAll: [Pen.SELECT],
    });

    const path = {
      id: 'vello-rough-3',
      type: 'rough-path',
      d: 'M 100 120 L 200 200 L 300 100 Z',
      fill: 'red',
      stroke: 'black',
      roughFillStyle: 'dots',
      roughHachureGap: 10,
      zIndex: 0,
    } as const;

    const polyline = {
      id: 'vello-rough-6',
      type: 'rough-polyline',
      points: '200,220 200,300 300,200',
      stroke: 'black',
      strokeWidth: 10,
      zIndex: 0,
    } as const;

    api.updateNodes([
      {
        id: 'vello-rough-1',
        type: 'rough-rect',
        x: 200,
        y: 20,
        fill: 'red',
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'hachure',
        zIndex: 0,
      },
      {
        id: 'vello-rough-2',
        type: 'rough-ellipse',
        x: 300,
        y: 20,
        fill: 'red',
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'hachure',
        roughHachureGap: 10,
        zIndex: 0,
      },
      path,
      {
        id: 'vello-rough-4',
        type: 'rough-rect',
        x: 400,
        y: 20,
        fill: 'red',
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'zigzag',
        roughHachureGap: 20,
        zIndex: 0,
      },
      {
        id: 'vello-rough-5',
        type: 'rough-rect',
        x: 500,
        y: 20,
        fill: 'red',
        stroke: 'black',
        width: 100,
        height: 100,
        roughFillStyle: 'cross-hatch',
        roughHachureGap: 20,
        zIndex: 0,
      },
      polyline,
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

    const VelloRendererPlugin = RendererPlugin.configure({
        setupDeviceSystemCtor: InitVello,
        rendererSystemCtor: VelloPipeline,
    });
    DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
    registerFont('/fonts/NotoSans-Regular.ttf');

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
  onReadyFired = false;
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
</template>