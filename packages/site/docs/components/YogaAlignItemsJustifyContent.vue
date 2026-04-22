<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  TRANSFORMER_MASK_FILL_COLOR,
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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      taskbarSelected: [
        Task.SHOW_PROPERTIES_PANEL,
      ],
      propertiesPanelSectionsOpen: {
        shape: false,
        transform: false,
        layout: true,
        effects: false,
      },
    });

    const parent = {
      id: 'yoga-align-items-justify-content-parent',
      type: 'rect',
      x: 100,
      y: 100,
      fill: 'grey',
      display: 'flex',
      width: 200,
      height: 250,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 0,
    } as const;

    const child = {
      id: 'yoga-align-items-justify-content-child1',
      parentId: 'yoga-align-items-justify-content-parent',
      type: 'rect',
      fill: TRANSFORMER_MASK_FILL_COLOR,
      width: 50,
      height: 50,
      zIndex: 1,
    } as const;

    const child2 = {
      id: 'yoga-align-items-justify-content-child2',
      parentId: 'yoga-align-items-justify-content-parent',
      type: 'rect',
      fill: TRANSFORMER_MASK_FILL_COLOR,
      width: 50,
      height: 50,
      zIndex: 1,
    } as const;

    api.updateNodes([parent, child, child2]);
    api.selectNodes([parent]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.6, "cameraX": -200, "cameraY": 50}'>
  </ic-spectrum-canvas>
</template>