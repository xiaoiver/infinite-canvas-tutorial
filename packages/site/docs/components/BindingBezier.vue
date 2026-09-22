<script setup lang="ts">
import {
  Pen,
  EdgeStyle,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

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
    });

    const node1 = {
      id: 'binding-bezier-rect-1',
      type: 'rect',
      x: 100,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
    };
    const node2 = {
      id: 'binding-bezier-rect-2',
      type: 'ellipse',
      x: 225,
      y: 120,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
    };
    const node3 = {
      id: 'binding-bezier-rect-3',
      type: 'rect',
      x: 400,
      y: 150,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: 'green', opacity: 1 }],
    };
    const edge1 = {
      id: 'binding-bezier-line-1',
      type: 'path',
      fromId: 'binding-bezier-rect-1',
      toId: 'binding-bezier-rect-2',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
      edgeStyle: EdgeStyle.ORTHOGONAL,
      bezier: true,
    };
    const edge2 = {
      id: 'binding-bezier-line-2',
      type: 'path',
      fromId: 'binding-bezier-rect-2',
      toId: 'binding-bezier-rect-3',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
      edgeStyle: EdgeStyle.ORTHOGONAL,
      bezier: true,
    };

    api.updateNodes([
      node1, node2, node3, edge1, edge2,
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