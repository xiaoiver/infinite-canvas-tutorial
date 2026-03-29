<script setup lang="ts">
import {
  App,
  Pen,
  Task,
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

    api.runAtNextTick(() => {
      api.setAppState({
        cameraX: -100,
        penbarSelected: Pen.SELECT,
        penbarAll: [Pen.HAND, Pen.SELECT, Pen.TEXT],
      });

      const nodes = [
        {
          id: 'baseline-1',
          type: 'line',
          x1: 0,
          y1: 50,
          x2: 300,
          y2: 50,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 0,
        },
        {
          id: 'text-1',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (top)',
          anchorX: 50,
          anchorY: 50,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'top',
          zIndex: 1,
        },
        {
          id: 'baseline-2',
          type: 'line',
          x1: 0,
          y1: 100,
          x2: 300,
          y2: 100,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 3,
        },
        {
          id: 'text-2',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (hanging)',
          anchorX: 50,
          anchorY: 100,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'hanging',
          zIndex: 4,
        },
        {
          id: 'baseline-3',
          type: 'line',
          x1: 0,
          y1: 150,
          x2: 300,
          y2: 150,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-3',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (middle)',
          anchorX: 50,
          anchorY: 150,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'middle',
          zIndex: 6,
        },
        {
          id: 'baseline-4',
          type: 'line',
          x1: 0,
          y1: 200,
          x2: 300,
          y2: 200,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-4',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (alphabetic)',
          anchorX: 50,
          anchorY: 200,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'alphabetic',
          zIndex: 6,
        },
        {
          id: 'baseline-5',
          type: 'line',
          x1: 0,
          y1: 250,
          x2: 300,
          y2: 250,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-5',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (ideographic)',
          anchorX: 50,
          anchorY: 250,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'ideographic',
          zIndex: 6,
        },
        {
          id: 'baseline-6',
          type: 'line',
          x1: 0,
          y1: 300,
          x2: 300,
          y2: 300,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-6',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (bottom)',
          anchorX: 50,
          anchorY: 300,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'bottom',
          zIndex: 6,
        },
        {
          id: 'baseline-7',
          type: 'line',
          x1: 0,
          y1: 350,
          x2: 300,
          y2: 350,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 7,
        },
        {
          id: 'text-7',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (bottom)',
          anchorX: 50,
          anchorY: 350,
          fontSize: 16,
          fontFamily: 'Gaegu',
          textBaseline: 'bottom',
          wordWrap: true,
          wordWrapWidth: 30,
          maxLines: 3,
          textOverflow: 'ellipsis',
          zIndex: 7,
        },
      ];

      import('webfontloader').then((module) => {
        const WebFont = module.default;
        WebFont.load({
          google: {
            families: ['Gaegu'],
          },
          active: () => {
            api.runAtNextTick(() => {
              api.updateNodes(nodes);
            });
          }
        });
      });
    });
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
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px"></ic-spectrum-canvas>
  </div>
</template>