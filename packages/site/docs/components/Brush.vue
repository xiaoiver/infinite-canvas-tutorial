<script setup lang="ts">
import {
  Pen,
  BrushType,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
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

    const node: BrushSerializedNode = {
      id: 'brush-1',
      type: 'brush',
      points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
      brushType: BrushType.VANILLA,
      stroke: 'grey',
      strokeWidth: 10,
      strokeOpacity: 1,
      zIndex: 0,
    };

    api.updateNodes([
      node,
    ]);
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>