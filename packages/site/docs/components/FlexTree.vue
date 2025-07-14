<script setup lang="ts">
import { Canvas, Rect, Path } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import { hierarchy } from 'd3-hierarchy';
import { flextree } from 'd3-flextree';

let canvas: Canvas;
let stats: any;

const wrapper = ref<HTMLCanvasElement | null>(null);

function measureText(text: string, fontSize: number) {
  const $canvas = document.createElement('canvas');
  const ctx = $canvas.getContext('2d');
  ctx!.font = `${fontSize}px Courier, monospace`;
  return ctx!.measureText(text).width;
}

function drawNode(node) {
  const { x, y } = node;
  const { width, height } = node.data as any;

  const rect = new Rect({
    x: y,
    y: x,
    width,
    height,
    fill: 'red',
  });
  canvas.appendChild(rect);
}

function drawLink(n, c) {
  const { x: beginY, y: beginX } = n;
  const { width, height } = n.data;
  const { x: endY, y: endX } = c;

  const line = new Path({
    stroke: 'black',
    strokeWidth: 2,
    fill: 'none',
    d: `M${beginX + width},${beginY + height / 2} L${endX},${endY + height / 2}`
  });
  canvas.appendChild(line);
}

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  import('stats.js').then(m => {
    const Stats = m.default;
    stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';
    $canvas.parentElement?.appendChild($stats);
  });

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = (e as any).detail;
    const res = await fetch('/data/mind.json');
    const root = hierarchy(await res.json());
    root.each((node) => {
      node.data.width = measureText((node.data as any).id, 16);
      node.data.height = 30;
    });

    flextree({})
      .nodeSize((node) => {
        const { width, height } = node.data as any;
        const paddingX = 50;
        const spacingHorizontal = 10;
        return [height, width + (width ? paddingX * 2 : 0) + spacingHorizontal];
      })
      .spacing((a, b) => {
        const spacingVertical = 6;
        return (
          (a.parent === b.parent ? spacingVertical : spacingVertical * 2)
        );
      })(root);

    root.each((node) => {
      if (node.children) {
        node.children.forEach((child) => {
          drawLink(node, child);
        });
      }

      drawNode(node);
    });

    canvas.root.position.x = 600;
    canvas.root.position.y = 500;
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative;">
    <ic-canvas ref="wrapper" style="height: 300px" zoom="30"></ic-canvas>
  </div>
</template>
