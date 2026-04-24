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

    const button1 = {
      id: 'yoga-button-1',
      type: 'rect',
      x: 100,
      y: 100,
      fill: 'grey',
      display: 'flex',
      width: 200,
      height: 100,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      cornerRadius: 10,
      zIndex: 0,
    } as const;

    const text1 = {
      id: 'yoga-button-text-1',
      parentId: 'yoga-button-1',
      type: 'text',
      content: 'Button',
      fontFamily: 'system-ui',
      fontSize: 32,
      lineHeight: 40,
      fill: 'white',
      zIndex: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      wordWrap: true,
      wordWrapWidth: 100,
      maxLines: 1,
      textOverflow: 'ellipsis',
    };

    const button2 = {
      id: 'yoga-button-2',
      type: 'rect',
      x: 100,
      y: 200,
      fill: 'red',
      display: 'flex',
      width: 200,
      height: 100,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      cornerRadius: 10,
      zIndex: 0,
    } as const;

    const text2 = {
      id: 'yoga-button-text-2',
      parentId: 'yoga-button-2',
      type: 'text',
      content: 'Button',
      fontFamily: 'system-ui',
      fontSize: 32,
      lineHeight: 40,
      fill: 'white',
      zIndex: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      wordWrap: true,
      wordWrapWidth: 100,
      maxLines: 1,
      textOverflow: 'ellipsis',
    };

    api.updateNodes([button1, text1, button2, text2]);
    api.selectNodes([button1]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.6, "cameraX": -200, "cameraY": 50}'>
  </ic-spectrum-canvas>
</template>