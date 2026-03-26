<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  Task,
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
      cameraZoom: 0.7,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      taskbarSelected: [Task.SHOW_LAYERS_PANEL],
      layersExpanded: ['transformer-group-1'],
    });

    const group = {
      id: 'transformer-group-1',
      type: 'g',
    };

    const node1 = {
      id: 'transformer-group-rect-1',
      parentId: 'transformer-group-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: 'red',
      stroke: 'black',
      strokeWidth: 10,
    };

    const node2 = {
      id: 'transformer-group-ellipse-1',
      parentId: 'transformer-group-1',
      type: 'ellipse',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      fill: 'red',
      stroke: 'black',
      strokeWidth: 10,
    };

    api.updateNodes([
      group, node1, node2
    ]);
    api.selectNodes([group]);
    api.record();
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