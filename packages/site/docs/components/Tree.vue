<script setup lang="ts">
import { Canvas, Circle, Path } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import { tree, hierarchy } from 'd3-hierarchy';

let canvas: Canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref<HTMLCanvasElement | null>(null);

function drawNode(node) {
  const { x, y } = node;
  const circle = new Circle({
    cx: x,
    cy: y,
    r: 4,
    fill: 'red',
  });
  canvas.appendChild(circle);
}

function drawLink(n, c) {
  const { x: beginX, y: beginY } = n;
  const { x: endX, y: endY } = c;

  const line = new Path({
    stroke: 'black',
    strokeWidth: 2,
    fill: 'none',
    d: `M${beginX},${beginY} L${endX},${endY}`
  });
  canvas.appendChild(line);
}

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  $canvas.parentElement!.appendChild($stats);

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = (e as any).detail;
    const res = await fetch('/data/mind.json');
    const root = hierarchy(await res.json());

    // Compute the layout.
    const width = 640;
    const padding = 10;
    const dx = 10;
    const dy = width / (root.height + padding);
    tree().nodeSize([dx, dy])(root);

    root.each((node) => {
      if (node.children) {
        node.children.forEach((child) => {
          drawLink(node, child);
        });
      }

      drawNode(node);
    });

    canvas.root.position.x = 300;
    canvas.root.position.y = 100;
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative;">
    <ic-canvas ref="wrapper" style="height: 300px" zoom="100"></ic-canvas>
  </div>
</template>
