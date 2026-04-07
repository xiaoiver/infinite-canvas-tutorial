<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RendererPlugin,
  DefaultRendererPlugin,
  CheckboardStyle,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import {
  InitVello,
  VelloPipeline,
  registerFont,
} from '@infinite-canvas-tutorial/vello';

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
      checkboardStyle: CheckboardStyle.NONE,
      themeMode: ThemeMode.DARK,
      giEnabled: true,
      giStrength: 0.1,
    });

    const node1 = {
      id: 'radiance-rect-1',
      type: 'rect',
      x: 100,
      y: 0,
      width: 100,
      height: 100,
      fill: 'grey',
    };
    const node2 = {
      id: 'radiance-rect-2',
      type: 'ellipse',
      x: 300,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
    };
    const node3 = {
      id: 'radiance-rect-3',
      type: 'rect',
      x: 400,
      y: 150,
      width: 100,
      height: 100,
      fill: 'green',
    };
    const edge1 = {
      id: 'radiance-line-1',
      type: 'line',
      fromId: 'rect-1',
      toId: 'rect-2',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
    };
    const edge2 = {
      id: 'radiance-line-2',
      type: 'line',
      fromId: 'rect-2',
      toId: 'rect-3',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
    };

    const line = {
      id: 'radiance-line-3',
      type: 'line',
      x1: 100,
      y1: 200,
      x2: 200,
      y2: 300,
      stroke: 'grey',
      strokeWidth: 10,
    };

    const polyline = {
      id: 'radiance-polyline-1',
      type: 'polyline',
      points: '500,0 600,100 700,0',
      stroke: 'grey',
      strokeWidth: 10,
    };

    api.updateNodes([
      node1, node2, node3, edge1, edge2,
      line, polyline,
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
    DefaultPlugins.splice(
      DefaultPlugins.indexOf(DefaultRendererPlugin),
      1,
      VelloRendererPlugin,
    );
    registerFont('/fonts/NotoSans-Regular.ttf');
    registerFont('/fonts/Gaegu-Regular.ttf');

    new App()
      .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        LaserPointerPlugin,
        LassoPlugin,
        EraserPlugin,
        YogaPlugin,
      )
      .run();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
</template>