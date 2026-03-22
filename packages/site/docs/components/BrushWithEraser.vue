<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  BrushType,
  PathSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { BrushSerializedNode } from '@infinite-canvas-tutorial/ecs';

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
      cameraX: -100,
      cameraY: 100,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.BRUSH],
    });

    // Generate sinewave geometry
    const maxRadius = (1 / 3) * 100;
    const segmentCount = 32;

    const position: [number, number][] = [];
    const radius: number[] = [];

    const gr = (1 + Math.sqrt(5)) / 2; // golden ratio
    const pi = Math.PI;

    for (let i = 0; i <= segmentCount; ++i) {
      let a = i / segmentCount;
      let x = -pi + 2 * pi * a;
      let y = Math.sin(x) / gr;
      let r = Math.cos(x / 2.0) * maxRadius;

      position.push([x * 100 + 360, y * 100 + 120]);
      radius.push(r);
    }

    const clipParent: PathSerializedNode = {
      id: 'brush-with-eraser-1',
      type: 'path',
      clipMode: 'erase',
      // vertical stripes, width 100, height 200, gap 50
      d: 'M 0 100 L 50 100 L 50 300 L 0 300 Z M 100 100 L 150 100 L 150 300 L 100 300 Z M 200 100 L 250 100 L 250 300 L 200 300 Z',
      fill: 'none',
      zIndex: 0,
    };

    const node: BrushSerializedNode = {
      id: 'brush-with-eraser-2',
      type: 'brush',
      parentId: 'brush-with-eraser-1',
      // brushType: BrushType.VANILLA,
      brushType: BrushType.STAMP,
      brushStamp: '/stamp1.png',
      stampInterval: 0.4,
      // brushStamp: '/brush.jpg',
      points: position.map(([x, y], i) => `${x - 200},${y + 20},${radius[i]}`).join(' '),
      stroke: 'red',
      strokeWidth: 10,
      strokeOpacity: 1,
      zIndex: 0,
    };

    api.updateNodes([
      clipParent, node,
    ]);
    api.selectNodes([clipParent]);
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