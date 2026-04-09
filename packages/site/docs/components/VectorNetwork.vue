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

    const vn = {
      type: 'vector-network',
      id: 'vn-1',
      zIndex: 3,
      stroke: 'black',
      strokeWidth: 10,
      fill: 'red',

      // The vertices of the triangle
      vertices: [
        { x: 100, y: 0 },
        { x: 200, y: 100 },
        { x: 300, y: 0 },
      ],

      // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
      segments: [
        {
          start: 0,
          tangentStart: { x: 0, y: 0 }, // optional
          end: 1,
          tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
          start: 1,
          end: 2,
        },
        {
          start: 2,
          end: 0,
        },
      ],

      // The loop that forms the triangle. Each loop is a
      // sequence of indices into the segments array.
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
    };

    // Bezier
    const vn2 = {
      type: 'vector-network',
      id: 'vn-2',
      zIndex: 3,
      stroke: 'black',
      strokeWidth: 10,
      vertices: [
        {
          x: 0,
          y: 0,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        {
          x: 100,
          y: 0,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 50, y: -50 },
          tangentEnd: { x: -50, y: -50 }
        }
      ],
      regions: []
    };

    api.updateNodes([vn, vn2]);
    api.selectNodes([vn]);
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