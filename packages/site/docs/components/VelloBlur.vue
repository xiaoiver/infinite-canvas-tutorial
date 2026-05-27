<script setup lang="ts">
import {
  Pen,
  RendererPlugin,
  DefaultRendererPlugin,
  svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { InitVello, VelloPipeline, registerFont } from '@infinite-canvas-tutorial/vello';

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

    api.runAtNextTick(() => {
        api.updateNodes([
          {
            id: 'vello-blur-1',
            type: 'rect',
            x: 200,
            y: 20,
            fills: [{ type: 'solid', value: 'red', opacity: 1 }],
            width: 100,
            height: 100,
            filter: 'blur(5px)',
            cornerRadius: 10,
            zIndex: 0,
          }
        ]);
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await ensureExampleWorld([UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin, YogaPlugin]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 200px"></ic-spectrum-canvas>
</template>